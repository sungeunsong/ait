/// Linux command dictionary for autocomplete suggestions
/// Provides common commands when no history is available

pub const COMMON_COMMANDS: &[&str] = &[
    // File operations
    "ls",
    "ls -l",
    "ls -la",
    "ls -lh",
    "ls -lha",
    "ls -ltr",
    "cd",
    "cd ..",
    "cd ~",
    "cd -",
    "pwd",
    "mkdir",
    "mkdir -p",
    "rmdir",
    "rm",
    "rm -r",
    "rm -rf",
    "cp",
    "cp -r",
    "mv",
    "touch",
    "cat",
    "less",
    "more",
    "head",
    "tail",
    "tail -f",
    "ln",
    "ln -s",

    // Text processing
    "grep",
    "grep -r",
    "grep -i",
    "grep -v",
    "find",
    "find . -name",
    "sed",
    "awk",
    "cut",
    "sort",
    "uniq",
    "wc",
    "wc -l",
    "diff",
    "comm",

    // File permissions
    "chmod",
    "chmod +x",
    "chmod 755",
    "chmod 644",
    "chown",
    "chgrp",

    // Archive operations
    "tar",
    "tar -xzf",
    "tar -czf",
    "tar -xvf",
    "tar -cvf",
    "zip",
    "unzip",
    "gzip",
    "gunzip",
    "bzip2",
    "bunzip2",

    // System information
    "df",
    "df -h",
    "du",
    "du -sh",
    "free",
    "free -h",
    "top",
    "htop",
    "ps",
    "ps aux",
    "ps -ef",
    "uptime",
    "uname",
    "uname -a",
    "hostname",
    "whoami",
    "who",
    "w",

    // Process management
    "kill",
    "killall",
    "pkill",
    "bg",
    "fg",
    "jobs",
    "nohup",

    // Network
    "ping",
    "ping -c",
    "curl",
    "wget",
    "ssh",
    "scp",
    "rsync",
    "netstat",
    "netstat -tulpn",
    "ss",
    "ifconfig",
    "ip addr",
    "ip route",
    "traceroute",
    "nslookup",
    "dig",

    // Package management (apt)
    "apt update",
    "apt upgrade",
    "apt install",
    "apt remove",
    "apt search",
    "apt-get update",
    "apt-get upgrade",
    "apt-get install",

    // Package management (yum/dnf)
    "yum update",
    "yum install",
    "yum remove",
    "dnf update",
    "dnf install",

    // System control
    "systemctl start",
    "systemctl stop",
    "systemctl restart",
    "systemctl status",
    "systemctl enable",
    "systemctl disable",
    "service",

    // User management
    "sudo",
    "su",
    "useradd",
    "usermod",
    "userdel",
    "passwd",
    "groupadd",
    "groupmod",

    // Disk operations
    "mount",
    "umount",
    "fdisk",
    "parted",
    "mkfs",

    // Editors
    "nano",
    "vim",
    "vi",
    "emacs",

    // Shell
    "echo",
    "printf",
    "export",
    "source",
    "alias",
    "history",
    "clear",
    "exit",
    "logout",

    // Git
    "git status",
    "git add",
    "git commit",
    "git commit -m",
    "git push",
    "git pull",
    "git clone",
    "git checkout",
    "git branch",
    "git log",
    "git diff",
    "git merge",

    // Docker
    "docker ps",
    "docker ps -a",
    "docker images",
    "docker run",
    "docker exec",
    "docker stop",
    "docker rm",
    "docker rmi",
    "docker logs",
    "docker-compose up",
    "docker-compose down",

    // Kubernetes
    "kubectl get pods",
    "kubectl get services",
    "kubectl describe",
    "kubectl logs",
    "kubectl exec",
    "kubectl apply",
    "kubectl delete",
];

/// Get command suggestions from dictionary that match the prefix
pub fn get_dict_suggestions(prefix: &str, limit: usize) -> Vec<String> {
    if prefix.is_empty() {
        return COMMON_COMMANDS
            .iter()
            .take(limit)
            .map(|s| s.to_string())
            .collect();
    }

    COMMON_COMMANDS
        .iter()
        .filter(|cmd| cmd.starts_with(prefix))
        .take(limit)
        .map(|s| s.to_string())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_dict_suggestions_empty_prefix() {
        let suggestions = get_dict_suggestions("", 5);
        assert_eq!(suggestions.len(), 5);
        assert_eq!(suggestions[0], "ls");
    }

    #[test]
    fn test_get_dict_suggestions_with_prefix() {
        let suggestions = get_dict_suggestions("ls", 10);
        assert!(suggestions.len() > 0);
        assert!(suggestions.iter().all(|s| s.starts_with("ls")));
    }

    #[test]
    fn test_get_dict_suggestions_git() {
        let suggestions = get_dict_suggestions("git", 10);
        assert!(suggestions.len() > 0);
        assert!(suggestions.iter().all(|s| s.starts_with("git")));
    }

    #[test]
    fn test_get_dict_suggestions_no_match() {
        let suggestions = get_dict_suggestions("xyz123", 10);
        assert_eq!(suggestions.len(), 0);
    }
}
