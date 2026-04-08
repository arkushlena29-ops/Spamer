import type { Tab } from "./types";

const TABS: { id: Tab; label: string }[] = [
	{ id: "messenger", label: "Мессенджеры" },
	{ id: "email", label: "Email" },
];

interface Props {
	activeTab: Tab;
	onTabChange: (tab: Tab) => void;
}

export default function AppHeader({ activeTab, onTabChange }: Props) {
	return (
		<div
			style={{
				background: "linear-gradient(90deg, #1e40af 0%, #7c3aed 100%)",
				padding: "16px 32px",
				flexShrink: 0,
			}}>
			<h1
				style={{
					margin: 0,
					fontSize: "20px",
					fontWeight: 700,
					color: "#ffffff",
					letterSpacing: "-0.025em",
				}}>
				Мессенджер для взыскания
			</h1>
			<p
				style={{
					margin: "2px 0 0",
					fontSize: "13px",
					color: "rgba(255, 255, 255, 0.7)",
				}}>
				Отправка сообщений через мессенджеры
			</p>
			<div style={{ display: "flex", gap: "4px", marginTop: "14px" }}>
				{TABS.map(({ id, label }) => (
					<button
						key={id}
						onClick={() => onTabChange(id)}
						style={{
							padding: "6px 18px",
							fontSize: "13px",
							fontWeight: 600,
							border: "none",
							borderRadius: "6px",
							cursor: "pointer",
							background:
								activeTab === id ? "rgba(255,255,255,0.2)" : "transparent",
							color:
								activeTab === id ? "#ffffff" : "rgba(255,255,255,0.55)",
							transition: "background 0.15s, color 0.15s",
						}}
						onMouseEnter={(e) => {
							if (activeTab !== id)
								e.currentTarget.style.background = "rgba(255,255,255,0.1)";
						}}
						onMouseLeave={(e) => {
							if (activeTab !== id)
								e.currentTarget.style.background = "transparent";
						}}>
						{label}
					</button>
				))}
			</div>
		</div>
	);
}
