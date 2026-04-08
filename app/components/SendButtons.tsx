import { PLATFORMS } from "./constants";
import type { Platform, TelegramToast } from "./types";

interface Props {
	onSend: (platform: Platform) => void;
	tgLoading: boolean;
	toast: TelegramToast | null;
}

export default function SendButtons({ onSend, tgLoading, toast }: Props) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
			{(Object.keys(PLATFORMS) as Platform[]).map((platform) => {
				const config = PLATFORMS[platform];
				const isLoading = platform === "telegram" && tgLoading;
				return (
					<button
						key={platform}
						onClick={() => onSend(platform)}
						disabled={isLoading}
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: "10px",
							padding: "11px 20px",
							fontSize: "14px",
							fontWeight: 600,
							background: config.color,
							color: "#ffffff",
							border: "none",
							borderRadius: "10px",
							cursor: isLoading ? "not-allowed" : "pointer",
							opacity: isLoading ? 0.7 : 1,
							transition: "transform 0.1s, background 0.2s, box-shadow 0.2s",
							boxShadow: `0 4px 14px ${config.color}40`,
						}}
						onMouseEnter={(e) => {
							if (!isLoading) {
								e.currentTarget.style.background = config.hoverColor;
								e.currentTarget.style.transform = "translateY(-1px)";
							}
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.background = config.color;
							e.currentTarget.style.transform = "translateY(0)";
						}}>
						{config.icon}
						{isLoading ? "Поиск пользователя…" : config.label}
					</button>
				);
			})}

			{toast && (
				<div
					style={{
						padding: "10px 14px",
						borderRadius: "8px",
						fontSize: "13px",
						fontWeight: 500,
						background: toast.type === "success" ? "#14532d" : "#450a0a",
						color: toast.type === "success" ? "#86efac" : "#fca5a5",
						border: `1px solid ${toast.type === "success" ? "#166534" : "#7f1d1d"}`,
					}}>
					{toast.text}
				</div>
			)}
		</div>
	);
}
