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
    // 🔍 파일 탐색 & 디버깅 관련
    "stat",                       // 파일 상세 메타데이터
    "tree",                       // 디렉토리 트리 구조 출력
    "lsblk",                      // 블록 디바이스 보기
    "blkid",                      // 디스크 UUID / 타입 정보
    "du -h --max-depth=1",        // 1단계 폴더별 용량 보기
    "df -Th",                     // 파일시스템 타입 포함 디스크 상태
    "find / -type f -size +100M", // 100MB 이상 파일 검색
    "grep -rn",                   // 라인번호 포함 재귀 검색
    "grep --color=auto",          // 검색결과 색상 강조
    "grep -E",                    // 정규식 검색
    // 🧠 시스템 리소스 및 성능
    "vmstat 1",             // 실시간 CPU/메모리/IO 상태
    "iostat -xz 1",         // 디스크 IO 분석
    "sar -u 1 5",           // CPU 사용률 통계
    "dmesg | tail",         // 커널 로그 최근
    "uptime -p",            // 사람이 읽기 쉬운 형태의 부팅 시간
    "lscpu",                // CPU 정보 보기
    "lsmem",                // 메모리 블록 정보
    "numactl --hardware",   // NUMA 노드 정보
    "who -a",               // 로그인 정보 상세
    "last -n 10",           // 최근 로그인 내역
    "history | tail -n 20", // 최근 입력 명령 20개
    // 🌐 네트워크 진단 강화
    "ss -ltnp",                                                  // 리스닝 포트 + PID
    "ss -s",                                                     // 소켓 요약
    "curl -I",                                                   // HTTP 헤더만 보기
    "curl -L",                                                   // 리다이렉트 따라가기
    "curl -v",                                                   // 상세 디버깅 출력
    "curl -o /dev/null -w '%{http_code}\\n' http://example.com", // 상태코드만 보기
    "nmap -p 22,80,443 localhost",                               // 포트 스캔
    "ethtool eth0",                                              // 네트워크 인터페이스 정보
    "ip neigh show",                                             // ARP 캐시 보기
    "dig +short",                                                // DNS 결과만 출력
    "traceroute -n",                                             // IP 기반 경로 추적
    // 🧩 서비스 관리 / 로그
    "systemctl list-units --type=service", // 전체 서비스 상태 목록
    "systemctl list-timers",               // 타이머 목록
    "journalctl -xe",                      // 에러 로그 집중 보기
    "journalctl -u sshd -n 50",            // 특정 서비스 최근 50줄
    "service --status-all",                // init 기반 서비스 전체 상태
    "ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%mem", // 메모리 기준 정렬
    "pstree -p",                           // 프로세스 트리 보기
    "nice",                                // 프로세스 우선순위 조정
    "renice",                              // 실행 중 프로세스 우선순위 변경
    "kill -9 $(pidof nginx)",              // 특정 프로세스 강제 종료
    // 🧰 압축/백업/전송 추가
    "tar -tf",                                          // tar 내용 확인
    "tar --exclude=node_modules -czf archive.tar.gz .", // 폴더 제외 압축
    "rsync -avz source/ dest/",                         // 압축+동기화
    "scp -P 22 file.txt user@host:/tmp/",               // 포트 지정 전송
    "ssh-copy-id user@host",                            // SSH 키 등록
    "gzip -d",                                          // gzip 해제
    "xz -d",                                            // xz 해제
    "zip -r backup.zip ./data",                         // 폴더 압축
    "unzip -l backup.zip",                              // zip 파일 목록 보기
    // 🧑‍💻 사용자 / 그룹 / 권한
    "id",          // 현재 사용자 ID 정보
    "groups",      // 그룹 목록
    "sudo -l",     // sudo 권한 확인
    "visudo",      // sudoers 편집
    "passwd root", // 루트 비밀번호 변경
    "chage -l",    // 비밀번호 만료 정책 확인
    // 💾 디스크 및 파일시스템
    "lsblk -f",          // 파일시스템, UUID 포함
    "mount | grep /dev", // 현재 마운트 목록
    "umount -f",         // 강제 언마운트
    "e2fsck -f",         // ext 파일시스템 체크
    "resize2fs",         // ext2/3/4 용량 조정
    "partprobe",         // 파티션 변경 반영
    "df -i",             // inode 사용량 확인
    // 🧱 패키지 / 환경 관리
    "dpkg -l | grep",       // 설치된 패키지 확인
    "rpm -qa | grep",       // rpm 기반 패키지 확인
    "dnf list installed",   // dnf 설치 목록
    "yum clean all",        // yum 캐시 정리
    "apt autoremove",       // 불필요 패키지 삭제
    "apt list --installed", // 설치 목록
    "snap list",            // snap 패키지 목록
    // 🐳 Docker 보강
    "docker inspect",                   // 컨테이너 상세정보
    "docker stats",                     // 실시간 리소스 모니터
    "docker network ls",                // 네트워크 목록
    "docker volume ls",                 // 볼륨 목록
    "docker system df",                 // 도커 디스크 사용량
    "docker-compose logs -f",           // 실시간 로그 보기
    "docker exec -it <container> bash", // 컨테이너 접속
    "docker image prune -f",            // 사용 안 하는 이미지 정리
    "docker system prune -a",           // 전체 정리
    // ☸ Kubernetes 보강
    "kubectl get all",                                          // 모든 리소스 보기
    "kubectl get nodes -o wide",                                // 노드 상세 보기
    "kubectl get pods -A",                                      // 모든 네임스페이스의 Pod
    "kubectl describe pod",                                     // Pod 상세
    "kubectl logs -f",                                          // 실시간 로그
    "kubectl exec -it podname -- bash",                         // Pod 내부 접속
    "kubectl rollout restart deployment",                       // 디플로이 재배포
    "kubectl get events --sort-by=.metadata.creationTimestamp", // 이벤트 로그
    // 🧮 기타 유틸리티
    "date",               // 현재 시간
    "cal",                // 달력 보기
    "uptime -s",          // 부팅 시각
    "time",               // 명령 실행시간 측정
    "env",                // 환경변수 목록
    "printenv",           // 환경변수 출력
    "history -c",         // 명령 기록 초기화
    "alias ll='ls -alF'", // 별칭 설정 예시
    "unalias ll",         // 별칭 제거
    "sleep 5",            // 일정 시간 대기
    "watch -n 1 'df -h'", // 1초마다 디스크 상태 모니터링
    "uptime -p",          // 부팅 이후 시간 요약
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
