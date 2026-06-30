use std::io::Read;

fn decide() -> &'static str {
    let mut input = String::new();
    if std::io::stdin().read_to_string(&mut input).is_err() {
        return "deny";
    }
    let url = match std::env::var("RYUZI_APPROVAL_URL") {
        Ok(u) => u,
        Err(_) => return "deny",
    };
    let session_pk = match std::env::var("RYUZI_SESSION_PK") {
        Ok(s) => s,
        Err(_) => return "deny",
    };
    let parsed: serde_json::Value = match serde_json::from_str(&input) {
        Ok(v) => v,
        Err(_) => return "deny",
    };
    let body = serde_json::json!({
        "sessionPk": session_pk,
        "tool": parsed.get("tool_name").and_then(|v| v.as_str()).unwrap_or(""),
        "input": parsed.get("tool_input").cloned().unwrap_or(serde_json::Value::Null),
    });
    match ureq::post(&url).send_json(body) {
        Ok(resp) => match resp.into_json::<serde_json::Value>() {
            Ok(v) if v.get("permissionDecision").and_then(|d| d.as_str()) == Some("allow") => {
                "allow"
            }
            _ => "deny",
        },
        Err(_) => "deny",
    }
}

fn main() {
    let decision = decide();
    let out = serde_json::json!({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision
        }
    });
    println!("{out}");
}
