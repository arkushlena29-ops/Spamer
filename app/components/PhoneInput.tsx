interface Props {
	value: string;
	error: string | null;
	onChange: (value: string) => void;
	onClear: () => void;
}

export default function PhoneInput({ value, error, onChange, onClear }: Props) {
	return (
		<div>
			<label
				style={{
					display: "block",
					marginBottom: "6px",
					fontSize: "13px",
					fontWeight: 600,
					color: "#94a3b8",
					textTransform: "uppercase",
					letterSpacing: "0.05em",
				}}>
				Номер телефона должника
			</label>
			<div style={{ display: "flex", gap: "8px" }}>
				<input
					type="tel"
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder="например, 380501234567"
					style={{
						flex: 1,
						padding: "10px 14px",
						fontSize: "15px",
						background: "#0f172a",
						border: `1px solid ${error ? "#ef4444" : "#334155"}`,
						borderRadius: "8px",
						color: "#f1f5f9",
						outline: "none",
						transition: "border-color 0.2s",
					}}
					onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
					onBlur={(e) =>
						(e.target.style.borderColor = error ? "#ef4444" : "#334155")
					}
				/>
				<button
					onClick={onClear}
					style={{
						padding: "10px 14px",
						fontSize: "13px",
						fontWeight: 500,
						background: "#334155",
						color: "#94a3b8",
						border: "none",
						borderRadius: "8px",
						cursor: "pointer",
						whiteSpace: "nowrap",
						transition: "background 0.2s",
					}}
					onMouseEnter={(e) => (e.currentTarget.style.background = "#475569")}
					onMouseLeave={(e) => (e.currentTarget.style.background = "#334155")}>
					Очистить
				</button>
			</div>
			{error && (
				<p style={{ margin: "6px 0 0", fontSize: "12px", color: "#ef4444" }}>
					{error}
				</p>
			)}
		</div>
	);
}
