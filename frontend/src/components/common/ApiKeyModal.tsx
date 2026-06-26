/* API Key 配置弹窗 */

import { useState, useEffect } from "react";
import { api } from "../../services/api";

const LLM_PROVIDERS = [
  { value: "deepseek", label: "DeepSeek" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ApiKeyModal({ open, onClose }: Props) {
  const [provider, setProvider] = useState("deepseek");
  const [apiKey, setApiKey] = useState("");
  const [keyStatus, setKeyStatus] = useState<string>(""); // 已配置 / 未配置
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    checkStatus();
  }, [open]);

  const checkStatus = async () => {
    try {
      const res = await api.checkApiKey();
      setKeyStatus(res.configured ? "已配置" : "未配置");
      if (res.configured) setApiKey("");
    } catch {
      setKeyStatus("未知");
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setMessage("请输入 API Key");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await api.setApiKey(apiKey.trim(), provider);
      setMessage("API Key 已保存（重启服务后需重新设置）");
      setApiKey("");
      checkStatus();
    } catch (e: any) {
      setMessage("保存失败: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: 28,
          width: 420,
          maxWidth: "90vw",
          boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 20px", fontSize: 16 }}>LLM API Key 配置</h3>

        {/* 当前状态 */}
        <div
          style={{
            marginBottom: 16,
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 13,
            background: keyStatus === "已配置" ? "#f6ffed" : keyStatus === "未配置" ? "#fff7e6" : "#f5f5f5",
            color: keyStatus === "已配置" ? "#389e0d" : keyStatus === "未配置" ? "#d46b08" : "#999",
          }}
        >
          当前状态：{keyStatus || "检测中..."}
        </div>

        {/* 厂商选择 */}
        <label style={{ fontSize: 13, color: "#666", marginBottom: 6, display: "block" }}>
          LLM 厂商
        </label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #d9d9d9",
            borderRadius: 6,
            fontSize: 14,
            marginBottom: 14,
            background: "#fff",
          }}
        >
          {LLM_PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {/* Key 输入 */}
        <label style={{ fontSize: 13, color: "#666", marginBottom: 6, display: "block" }}>
          API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-xxxxxxxxxxxxxxxx"
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #d9d9d9",
            borderRadius: 6,
            fontSize: 14,
            marginBottom: 14,
            boxSizing: "border-box",
          }}
        />

        {/* 提示信息 */}
        {message && (
          <div
            style={{
              marginBottom: 14,
              padding: "6px 10px",
              borderRadius: 4,
              fontSize: 12,
              background: message.includes("失败") ? "#fff2f0" : "#f6ffed",
              color: message.includes("失败") ? "#ff4d4f" : "#389e0d",
            }}
          >
            {message}
          </div>
        )}

        {/* 按钮 */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "6px 16px",
              border: "1px solid #d9d9d9",
              background: "#fff",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            关闭
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "6px 16px",
              border: "none",
              background: saving ? "#a0c4ff" : "#4a6cf7",
              color: "#fff",
              borderRadius: 6,
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: 13,
            }}
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
