interface Props {
	value: string;
	onChange: (value: string) => void;
}

export default function MessageTemplate({ value, onChange }: Props) {
	return (
		<div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
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
				Шаблон сообщения
			</label>
			<textarea
				value={value}
				onChange={(e) => onChange(e.target.value)}
				style={{
					flex: 1,
					width: "100%",
					padding: "14px",
					fontSize: "13px",
					lineHeight: "1.6",
					background: "#0f172a",
					border: "1px solid #334155",
					borderRadius: "8px",
					color: "#f1f5f9",
					outline: "none",
					resize: "none",
					fontFamily: "inherit",
					boxSizing: "border-box",
					transition: "border-color 0.2s",
				}}
				onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
				onBlur={(e) => (e.target.style.borderColor = "#334155")}
			/>
		</div>
	);
}
