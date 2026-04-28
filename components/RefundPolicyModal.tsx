"use client";
import { useState, useEffect } from "react";
import { REFUND_POLICIES, COMMON_NOTICE_TEXT, type RefundPolicyKey } from "@/lib/refundPolicy";

interface Props {
  open: boolean;
  onClose: () => void;
  policyKeys: RefundPolicyKey[];
}

export default function RefundPolicyModal({ open, onClose, policyKeys }: Props) {
  const [activeKey, setActiveKey] = useState<RefundPolicyKey>(policyKeys[0]);

  // policyKeys 변경 시 첫 번째 탭으로 리셋
  useEffect(() => {
    if (policyKeys.length > 0) setActiveKey(policyKeys[0]);
  }, [policyKeys.join(",")]);

  if (!open) return null;
  const policy = REFUND_POLICIES[activeKey];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 12,
          maxWidth: 720,
          width: "100%",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111", margin: 0 }}>
            {policy.title}
          </h2>
          <button onClick={onClose} aria-label="close" style={{
            background: "transparent",
            border: "none",
            fontSize: 24,
            cursor: "pointer",
            color: "#6b7280",
            padding: 4,
            lineHeight: 1,
          }}>×</button>
        </div>

        <div style={{
          margin: "16px 20px 0",
          padding: "10px 14px",
          background: "#fef2f2",
          color: "#991b1b",
          fontSize: 13,
          fontWeight: 600,
          borderRadius: 8,
          textAlign: "center",
          lineHeight: 1.4,
        }}>
          {COMMON_NOTICE_TEXT}
        </div>

        {policyKeys.length > 1 && (
          <div style={{
            display: "flex",
            gap: 4,
            padding: "16px 20px 0",
            borderBottom: "1px solid #f3f4f6",
          }}>
            {policyKeys.map((k) => (
              <button
                key={k}
                onClick={() => setActiveKey(k)}
                style={{
                  padding: "10px 18px",
                  border: "none",
                  borderBottom: `2px solid ${activeKey === k ? "#3b82f6" : "transparent"}`,
                  background: "transparent",
                  color: activeKey === k ? "#3b82f6" : "#6b7280",
                  fontWeight: activeKey === k ? 700 : 500,
                  fontSize: 14,
                  cursor: "pointer",
                  marginBottom: -1,
                }}
              >
                {REFUND_POLICIES[k].label}
              </button>
            ))}
          </div>
        )}

        <div style={{
          padding: "20px",
          overflowY: "auto",
          flex: 1,
        }}>
          {policy.sections.map((sec, i) => (
            <div key={i} style={{ marginBottom: 22 }}>
              <div style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#111",
                marginBottom: 10,
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}>
                <span style={{ fontSize: 18 }}>{sec.icon}</span>
                <span>{sec.title}</span>
              </div>
              <ul style={{
                margin: 0,
                paddingLeft: 22,
                fontSize: 13,
                lineHeight: 1.6,
                color: "#374151",
              }}>
                {sec.bullets.map((b, j) => (
                  <li key={j} style={{ marginBottom: 6 }}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "flex-end",
        }}>
          <button onClick={onClose} style={{
            padding: "10px 24px",
            background: "#3b82f6",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
