use serde::{Deserialize, Serialize};
use std::error::Error;

/// AI 설정 구조체
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIConfig {
    pub server_url: String,
    pub model: String,
}

impl Default for AIConfig {
    fn default() -> Self {
        Self {
            server_url: "http://192.168.136.8:11434".to_string(),
            model: "gpt-oss:20b".to_string(),
        }
    }
}

/// Ollama API 요청 구조체
#[derive(Debug, Serialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
}

/// Ollama API 응답 구조체
#[derive(Debug, Deserialize)]
struct OllamaResponse {
    response: String,
    #[serde(default)]
    done: bool,
}

/// AI 응답 결과
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIResponse {
    pub response: String,
    pub model: String,
}

/// Ollama API를 통해 AI 질문을 처리
pub async fn ask_ollama(
    config: &AIConfig,
    prompt: &str,
    context: Option<&str>,
) -> Result<AIResponse, Box<dyn Error>> {
    // 시스템 프롬프트 구성 (한글 응답 요청)
    let system_prompt = r#"You are an expert Linux/Unix system administrator and terminal assistant.

Your responsibilities:
- Provide accurate, concise terminal commands for the user's tasks
- Explain commands clearly with key options
- Always wrap commands in ```bash code blocks
- Prioritize safety: warn about destructive commands (rm -rf, dd, etc.)
- Consider the user's current environment and context

Response format:
1. Brief explanation of the solution
2. Command(s) in ```bash blocks
3. Important notes or warnings if needed

**IMPORTANT: Always respond in Korean (한국어). All explanations must be in Korean.**

Keep responses focused and practical."#;

    // 컨텍스트가 있으면 추가
    let full_prompt = if let Some(ctx) = context {
        format!(
            "{}\n\n## Current Context\n{}\n\n## User Question\n{}",
            system_prompt, ctx, prompt
        )
    } else {
        format!("{}\n\n## User Question\n{}", system_prompt, prompt)
    };

    let client = reqwest::Client::new();
    let request = OllamaRequest {
        model: config.model.clone(),
        prompt: full_prompt,
        stream: false,
    };

    let url = format!("{}/api/generate", config.server_url);

    let response = client
        .post(&url)
        .json(&request)
        .timeout(std::time::Duration::from_secs(60))
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(format!("Ollama API error: {}", response.status()).into());
    }

    let ollama_response: OllamaResponse = response.json().await?;

    Ok(AIResponse {
        response: ollama_response.response,
        model: config.model.clone(),
    })
}

/// 응답에서 명령어 블록 추출 (```로 감싸진 부분)
pub fn extract_commands(response: &str) -> Vec<String> {
    let mut commands = Vec::new();
    let mut in_code_block = false;
    let mut current_command = String::new();

    for line in response.lines() {
        let trimmed = line.trim();

        // 코드 블록 시작/종료 감지
        if trimmed.starts_with("```") {
            if in_code_block && !current_command.is_empty() {
                commands.push(current_command.trim().to_string());
                current_command.clear();
            }
            in_code_block = !in_code_block;
            continue;
        }

        // 코드 블록 내부의 명령어 수집
        if in_code_block {
            if !trimmed.is_empty() && !trimmed.starts_with('#') {
                current_command.push_str(line);
                current_command.push('\n');
            }
        }
    }

    // 마지막 명령어 추가
    if !current_command.is_empty() {
        commands.push(current_command.trim().to_string());
    }

    commands
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_commands() {
        let response = r#"
You can use this command:

```bash
ls -la /home
```

Or this one:

```
cd /tmp
pwd
```
        "#;

        let commands = extract_commands(response);
        assert_eq!(commands.len(), 2);
        assert_eq!(commands[0], "ls -la /home");
        assert_eq!(commands[1], "cd /tmp\npwd");
    }

    #[test]
    fn test_extract_commands_with_comments() {
        let response = r#"
```bash
# This is a comment
ls -la
# Another comment
pwd
```
        "#;

        let commands = extract_commands(response);
        assert_eq!(commands.len(), 1);
        assert_eq!(commands[0], "ls -la\npwd");
    }
}
