import { PARAM_FIELDS } from "./constants";
import type { Params } from "./types";

interface Props {
	params: Params;
	onChange: (key: keyof Params, value: string) => void;
}

export default function MessageParams({ params, onChange }: Props) {
	return (
		<div style={{ flex: 1 }}>
			<label
				style={{
					display: "block",
					marginBottom: "8px",
					fontSize: "13px",
					fontWeight: 600,
					color: "#94a3b8",
					textTransform: "uppercase",
					letterSpacing: "0.05em",
				}}>
				Параметры сообщения
			</label>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
					gap: "10px",
				}}>
				{PARAM_FIELDS.map(({ key, label }) => (
					<div key={key}>
						<label
							style={{
								display: "block",
								marginBottom: "4px",
								fontSize: "11px",
								fontWeight: 600,
								color: "#64748b",
								textTransform: "uppercase",
								letterSpacing: "0.05em",
							}}>
							{label}
						</label>
						<input
							type="text"
							value={params[key]}
							onChange={(e) => onChange(key, e.target.value)}
							style={{
								width: "100%",
								padding: "7px 10px",
								fontSize: "13px",
								background: "#0f172a",
								border: "1px solid #334155",
								borderRadius: "6px",
								color: "#f1f5f9",
								outline: "none",
								boxSizing: "border-box",
								transition: "border-color 0.2s",
							}}
							onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
							onBlur={(e) => (e.target.style.borderColor = "#334155")}
						/>
					</div>
				))}
			</div>
		</div>
	);
}
