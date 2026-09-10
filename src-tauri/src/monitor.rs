//! System sampling.
//!
//! Owns the long-lived `System` handle. CPU usage is a difference between two
//! samples, so the reader has to persist across ticks — rebuilding it per call
//! is what forced the old command to sleep inside the request.

use serde::Serialize;
use std::sync::Mutex;
use sysinfo::{Components, Pid, ProcessRefreshKind, ProcessesToUpdate, Signal, System};

/// One row of the process log.
///
/// `cpuUsage` follows the `top`/Activity Monitor convention: percent of a
/// single core, so a busy multi-threaded process can legitimately exceed 100.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_usage: f32,
    pub memory: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemStats {
    /// 0-100, averaged across all logical cores.
    pub cpu_usage: f32,
    /// 0-100 per logical core.
    pub core_usage: Vec<f32>,
    pub total_memory: u64,
    pub used_memory: u64,
    pub swap_total: u64,
    pub swap_used: u64,
    /// Hottest readable sensor in Celsius, or `None` where the platform exposes
    /// none. Apple silicon reports an empty component list without elevated
    /// rights, so the console must treat this as "no channel", not "zero".
    pub temp_c: Option<f32>,
    pub temp_label: Option<String>,
    /// Sorted by `cpu_usage` descending. The console relies on this ordering.
    pub processes: Vec<ProcessInfo>,
}

pub struct Monitor {
    system: Mutex<System>,
    components: Mutex<Components>,
}

impl Monitor {
    pub fn new() -> Self {
        let mut system = System::new_all();
        // Prime the CPU counters so the first real sample is a valid diff
        // rather than a run of zeroes.
        system.refresh_cpu_usage();
        std::thread::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL);
        system.refresh_cpu_usage();

        Self {
            system: Mutex::new(system),
            components: Mutex::new(Components::new_with_refreshed_list()),
        }
    }

    /// Refresh every subsystem the console reads, and return one snapshot.
    pub fn sample(&self) -> Result<SystemStats, String> {
        let mut system = self.system.lock().map_err(|_| "system lock poisoned")?;

        system.refresh_cpu_usage();
        system.refresh_memory();
        // Disk usage and command lines cost real time and nothing on the panel
        // reads them, so they stay off.
        system.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing().with_cpu().with_memory(),
        );

        let mut processes: Vec<ProcessInfo> = system
            .processes()
            .values()
            .map(|p| ProcessInfo {
                pid: p.pid().as_u32(),
                name: p.name().to_string_lossy().into_owned(),
                cpu_usage: p.cpu_usage(),
                memory: p.memory(),
            })
            .collect();
        processes.sort_by(|a, b| {
            b.cpu_usage
                .partial_cmp(&a.cpu_usage)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let stats = SystemStats {
            cpu_usage: system.global_cpu_usage(),
            core_usage: system.cpus().iter().map(|c| c.cpu_usage()).collect(),
            total_memory: system.total_memory(),
            used_memory: system.used_memory(),
            swap_total: system.total_swap(),
            swap_used: system.used_swap(),
            temp_c: None,
            temp_label: None,
            processes,
        };
        drop(system);

        let (temp_c, temp_label) = self.hottest_component()?;
        Ok(SystemStats {
            temp_c,
            temp_label,
            ..stats
        })
    }

    fn hottest_component(&self) -> Result<(Option<f32>, Option<String>), String> {
        let mut components = self
            .components
            .lock()
            .map_err(|_| "component lock poisoned")?;
        components.refresh(false);

        Ok(components
            .list()
            .iter()
            .filter_map(|c| c.temperature().map(|t| (t, c.label().to_owned())))
            .max_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal))
            .map_or((None, None), |(t, label)| (Some(t), Some(label))))
    }

    /// Signal a process. `force` escalates SIGTERM to SIGKILL.
    pub fn kill(&self, pid: u32, force: bool) -> Result<(), String> {
        let mut system = self.system.lock().map_err(|_| "system lock poisoned")?;
        let pid = Pid::from_u32(pid);

        // Re-read just this pid: the cached table may be a second stale, and
        // signalling a pid that has already been recycled is how you kill the
        // wrong process.
        system.refresh_processes_specifics(
            ProcessesToUpdate::Some(&[pid]),
            true,
            ProcessRefreshKind::nothing(),
        );

        let process = system
            .process(pid)
            .ok_or_else(|| format!("no process with pid {pid}"))?;

        let signal = if force { Signal::Kill } else { Signal::Term };
        match process.kill_with(signal) {
            Some(true) => Ok(()),
            Some(false) => Err(format!("{signal:?} refused for pid {pid}")),
            // Signal unsupported on this platform; SIGKILL always exists.
            None if process.kill() => Ok(()),
            None => Err(format!("could not signal pid {pid}")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sample_satisfies_the_console_contract() {
        let monitor = Monitor::new();
        let stats = monitor.sample().expect("sample");

        assert!(
            !stats.core_usage.is_empty(),
            "core array needs at least one channel"
        );
        assert!(stats.total_memory > 0, "total memory must be known");
        assert!(
            stats.used_memory <= stats.total_memory,
            "used {} exceeded total {}",
            stats.used_memory,
            stats.total_memory
        );
        assert!(
            stats.swap_used <= stats.swap_total,
            "swap used exceeded swap total"
        );
        assert!(!stats.processes.is_empty(), "process table was empty");

        // The console renders this order verbatim; it does not re-sort.
        let ordered = stats
            .processes
            .windows(2)
            .all(|w| w[0].cpu_usage >= w[1].cpu_usage);
        assert!(ordered, "processes must arrive sorted by cpu_usage desc");

        for core in &stats.core_usage {
            assert!(
                (0.0..=100.0).contains(core),
                "core usage {core} outside 0-100"
            );
        }
    }

    #[test]
    fn serializes_to_the_camel_case_keys_the_frontend_expects() {
        let stats = SystemStats {
            cpu_usage: 12.5,
            core_usage: vec![1.0, 2.0],
            total_memory: 100,
            used_memory: 40,
            swap_total: 10,
            swap_used: 2,
            temp_c: None,
            temp_label: None,
            processes: vec![ProcessInfo {
                pid: 7,
                name: "init".into(),
                cpu_usage: 3.5,
                memory: 128,
            }],
        };
        let json = serde_json::to_value(&stats).expect("serialize");

        for key in [
            "cpuUsage",
            "coreUsage",
            "totalMemory",
            "usedMemory",
            "swapTotal",
            "swapUsed",
            "tempC",
            "tempLabel",
            "processes",
        ] {
            assert!(json.get(key).is_some(), "missing key {key}");
        }
        assert!(json["tempC"].is_null(), "absent sensor must be null");
        assert!(json["processes"][0].get("cpuUsage").is_some());
    }
}
