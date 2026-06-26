/* LLM 供应商 & API Key 配置页 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

interface ProviderOption {
  id: string;
  name: string;
  baseUrl: string;
  docUrl: string;
}

const PROVIDERS: ProviderOption[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    docUrl: "https://platform.deepseek.com/api_keys",
  },
];

export default function SettingsPage() {
  const navigate = useNavigate();

  const [provider, setProvider] = useState("deepseek");
  const [apiKey, setApiKey] = useState("");
  const [keyStatus, setKeyStatus] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error" | "">("");

  useEffect(() => {
    api.checkApiKey().then((res) => {
      setKeyStatus(res.configured);
    }).catch(() => setKeyStatus(false));
  }, []);

  const showMsg = (text: string, type: "success" | "error") => {
    setMessage(text);
    setMsgType(type);
    setTimeout(() => { setMessage(""); setMsgType(""); }, 4000);
  };

  const handleSet = async () => {
    if (!apiKey.trim()) {
      showMsg("请输入 API Key", "error");
      return;
    }
    try {
      await api.setApiKey(apiKey.trim());
      setKeyStatus(true);
      setApiKey("");
      showMsg(`API Key 已保存（${PROVIDERS.find((p) => p.id === provider)?.name}）`, "success");
    } catch (e: any) {
      showMsg(e.message || "保存失败", "error");
    }
  };

  const handleClear = async () => {
    try {
      await api.deleteApiKey();
      setKeyStatus(false);
      showMsg("API Key 已清除", "success");
    } catch (e: any) {
      showMsg(e.message || "清除失败", "error");
    }
  };

  const currentProvider = PROVIDERS.find((p) => p.id === provider)!;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate("/")}
          style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#333" }}
        >
          ← 返回
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>API 设置</h1>
      </div>

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e0e0e0", padding: 24 }}>
        {/* 状态指示 */}
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            marginBottom: 20,
            fontSize: 13,
            background: keyStatus === null ? "#f5f5f5" : keyStatus ? "#f6ffed" : "#fff2f0",
            border: `1px solid ${keyStatus === null ? "#e0e0e0" : keyStatus ? "#b7eb8f" : "#ffccc7"}`,
            color: keyStatus === null ? "#999" : keyStatus ? "#52c41a" : "#ff4d4f",
          }}
        >
          {keyStatus === null ? "检测中..." : keyStatus ? "API Key 已配置" : "尚未配置 API Key"}
        </div>

        {/* 供应商选择 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>LLM 供应商</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              border: "1px solid #d9d9d9",
              borderRadius: 6,
              fontSize: 14,
              background: "#fff",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
            API 地址: {currentProvider.baseUrl} ·{" "}
            <a href={currentProvider.docUrl} target="_blank" rel="noopener" style={{ color: "#4a6cf7" }}>
              获取 Key
            </a>
          </div>
        </div>

        {/* Key 输入 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>
            {currentProvider.name} API Key
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-xxxxxxxxxxxxxxxx"
              style={{
                flex: 1,
                padding: "8px 10px",
                border: "1px solid #d9d9d9",
                borderRadius: 6,
                fontSize: 14,
                fontFamily: "monospace",
                outline: "none",
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSet()}
            />
            <button
              onClick={handleSet}
              style={{
                padding: "8px 18px",
                background: "#4a6cf7",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              保存
            </button>
          </div>
        </div>

        {/* 清除 */}
        <button
          onClick={handleClear}
          style={{
            padding: "6px 16px",
            border: "1px solid #ff4d4f",
            color: "#ff4d4f",
            background: "#fff",
            borderRadius: 6,
            fontSize: 13,
            cursor: keyStatus ? "pointer" : "not-allowed",
            opacity: keyStatus ? 1 : 0.4,
          }}
          disabled={!keyStatus}
        >
          清除已保存的 Key
        </button>

        {/* 操作提示 */}
        {message && (
          <div
            style={{
              marginTop: 16,
              padding: "8px 12px",
              borderRadius: 6,
              fontSize: 13,
              background: msgType === "success" ? "#f6ffed" : "#fff2f0",
              border: `1px solid ${msgType === "success" ? "#b7eb8f" : "#ffccc7"}`,
              color: msgType === "success" ? "#52c41a" : "#ff4d4f",
            }}
          >
            {message}
          </div>
        )}

        <div
          style={{
            marginTop: 20,
            padding: "10px 12px",
            background: "#fafafa",
            borderRadius: 6,
            fontSize: 11,
            color: "#999",
            lineHeight: 1.6,
          }}
        >
          Key 经加密后存入服务端临时文件，重启服务自动丢失。前端不会以任何形式存储你的 Key。
        </div>
      </div>
    </div>
  );
}
