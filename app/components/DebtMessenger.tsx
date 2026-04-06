"use client";

import React, { useState, useCallback, useRef } from "react";

const DEFAULT_MESSAGE = `Добрий день, мене звати Олена Миколаївна. Представник ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ «ФІНАНСОВА КОМПАНІЯ «ЕЛІТ ФІНАНС». Звертаюсь до вас щодо кредиту, який ви оформлювали в 'Таском Банк' кредитний договір 002/9168914-SP сума боргу на сьогодні складає 15987 грн. У вас надалі може бути нараховано інфляцію та 3 % річних згідно ст625 ЦКУ, що призведе до збільшення суми боргу для того щоб дані санкції не було застосовано, ми готові піти вам на зустріч та зробити розтермінування заборгованості на 7 місяців по 2284 грн. Перший платіж необхідно внести до 7 квітня. Робити Вам розтермінування?`;

const cleanPhone = (raw: string): string => raw.replace(/[\s\-\(\)]/g, "");

const buildUri = (
	platform: "whatsapp" | "viber",
	phone: string,
	message: string,
): string => {
	const encoded = encodeURIComponent(message);
	switch (platform) {
		case "whatsapp":
			return `https://wa.me/${phone}?text=${encoded}`;
		case "viber":
			return `viber://chat?number=%2B${phone.replace(/^\+/, "")}`;
	}
};

type Platform = "whatsapp" | "telegram" | "viber";

interface TelegramToast {
	type: "success" | "error";
	text: string;
}

interface PlatformConfig {
	label: string;
	color: string;
	hoverColor: string;
	icon: React.ReactNode;
}

const PLATFORMS: Record<Platform, PlatformConfig> = {
	whatsapp: {
		label: "Отправить через WhatsApp",
		color: "#25D366",
		hoverColor: "#1EBE57",
		icon: (
			<svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
				<path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z' />
			</svg>
		),
	},
	telegram: {
		label: "Отправить через Telegram",
		color: "#0088cc",
		hoverColor: "#0077b5",
		icon: (
			<svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
				<path d='M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z' />
			</svg>
		),
	},
	viber: {
		label: "Отправить через Viber",
		color: "#7360F2",
		hoverColor: "#5946d2",
		icon: (
			<svg width='20' height='20' viewBox='0 0 24 24' fill='currentColor'>
				<path d='M11.398.002C9.473.028 5.331.344 3.014 2.467 1.294 4.179.529 7.143.46 11.348c-.007.418-.01.875-.01 1.374 0 .498.003.955.01 1.374.069 4.205.834 7.169 2.554 8.881 2.317 2.123 6.459 2.439 8.384 2.465h1.204c1.925-.026 6.067-.342 8.384-2.465 1.72-1.712 2.485-4.676 2.554-8.881.007-.419.01-.876.01-1.374 0-.499-.003-.956-.01-1.374-.069-4.205-.834-7.169-2.554-8.881C19.266.344 15.124.028 13.199.002h-1.801zm-.604 1.998h1.208c3.789.051 7.385.353 8.974 1.827 1.396 1.298 2.053 3.804 2.112 7.523.006.398.009.834.009 1.312 0 .477-.003.913-.009 1.312-.059 3.719-.716 6.225-2.112 7.523-1.589 1.474-5.185 1.776-8.974 1.827h-1.208c-3.789-.051-7.385-.353-8.974-1.827-1.396-1.298-2.053-3.804-2.112-7.523A38.168 38.168 0 0 1 .699 12.662c0-.478.003-.914.009-1.312.059-3.719.716-6.225 2.112-7.523C4.409 2.353 8.005 2.051 11.794 2h-.004l-.004.002-.004-.002h.016zm.604 3.002c-.276 0-.5.224-.5.5s.224.5.5.5c2.481 0 4.5 2.019 4.5 4.5 0 .276.224.5.5.5s.5-.224.5-.5c0-3.033-2.467-5.5-5.5-5.5zm0 2c-.276 0-.5.224-.5.5s.224.5.5.5c1.379 0 2.5 1.121 2.5 2.5 0 .276.224.5.5.5s.5-.224.5-.5c0-1.93-1.57-3.5-3.5-3.5zm0 4c-.276 0-.5.224-.5.5s.224.5.5.5c.276 0 .5-.224.5-.5s-.224-.5-.5-.5z' />
			</svg>
		),
	},
};

export default function DebtMessenger() {
	const [phone, setPhone] = useState("");
	const [message, setMessage] = useState(DEFAULT_MESSAGE);
	const [error, setError] = useState<string | null>(null);
	const [tgLoading, setTgLoading] = useState(false);
	const [tgToast, setTgToast] = useState<TelegramToast | null>(null);
	const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const showToast = (toast: TelegramToast) => {
		if (toastTimer.current) clearTimeout(toastTimer.current);
		setTgToast(toast);
		toastTimer.current = setTimeout(() => setTgToast(null), 4000);
	};

	const handleSend = useCallback(
		async (platform: Platform) => {
			const cleaned = cleanPhone(phone);

			if (!cleaned) {
				setError("Введите номер телефона");
				return;
			}

			if (!/^\+?\d{10,15}$/.test(cleaned)) {
				setError(
					"Номер телефона должен содержать 10-15 цифр (допускается префикс +)",
				);
				return;
			}

			setError(null);

			if (platform === "telegram") {
				setTgLoading(true);
				try {
					const res = await fetch("/api/telegram/resolve-phone", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ phone: cleaned, message }),
					});
					const data = await res.json();

					if (!res.ok) {
						showToast({
							type: "error",
							text: data.error ?? "Не удалось отправить сообщение",
						});
						return;
					}

					showToast({
						type: "success",
						text: `Сообщение отправлено${data.firstName ? ` (${data.firstName})` : ""}`,
					});
				} catch {
					showToast({ type: "error", text: "Ошибка соединения с сервером" });
				} finally {
					setTgLoading(false);
				}
				return;
			}

			if (platform === "viber") {
				await navigator.clipboard.writeText(message).catch(() => {});
				window.open(buildUri("viber", cleaned, message), "_blank");
				showToast({
					type: "success",
					text: "Сообщение скопировано — вставьте в чат (Ctrl+V)",
				});
				return;
			}

			const uri = buildUri(platform, cleaned, message);
			window.open(uri, "_blank");
		},
		[phone, message],
	);

	const handleClearPhone = () => {
		setPhone("");
		setError(null);
	};

	return (
		<div
			style={{
				minHeight: "100vh",
				background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
				display: "flex",
				alignItems: "flex-start",
				justifyContent: "center",
				padding: "40px 16px",
				fontFamily:
					'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
			}}>
			<div
				style={{
					width: "100%",
					maxWidth: "640px",
					background: "#1e293b",
					borderRadius: "16px",
					border: "1px solid #334155",
					boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
					overflow: "hidden",
				}}>
				<div
					style={{
						background: "linear-gradient(90deg, #1e40af 0%, #7c3aed 100%)",
						padding: "24px 32px",
					}}>
					<h1
						style={{
							margin: 0,
							fontSize: "24px",
							fontWeight: 700,
							color: "#ffffff",
							letterSpacing: "-0.025em",
						}}>
						Мессенджер для взыскания
					</h1>
					<p
						style={{
							margin: "4px 0 0",
							fontSize: "14px",
							color: "rgba(255, 255, 255, 0.7)",
						}}>
						Отправка сообщений через мессенджеры
					</p>
				</div>

				<div style={{ padding: "32px" }}>
					<label
						style={{
							display: "block",
							marginBottom: "8px",
							fontSize: "14px",
							fontWeight: 600,
							color: "#94a3b8",
							textTransform: "uppercase",
							letterSpacing: "0.05em",
						}}>
						Номер телефона должника
					</label>
					<div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
						<input
							type='tel'
							value={phone}
							onChange={(e) => {
								setPhone(e.target.value);
								setError(null);
							}}
							placeholder='например, 380501234567'
							style={{
								flex: 1,
								padding: "12px 16px",
								fontSize: "16px",
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
							onClick={handleClearPhone}
							style={{
								padding: "12px 16px",
								fontSize: "14px",
								fontWeight: 500,
								background: "#334155",
								color: "#94a3b8",
								border: "none",
								borderRadius: "8px",
								cursor: "pointer",
								whiteSpace: "nowrap",
								transition: "background 0.2s",
							}}
							onMouseEnter={(e) =>
								(e.currentTarget.style.background = "#475569")
							}
							onMouseLeave={(e) =>
								(e.currentTarget.style.background = "#334155")
							}>
							Очистить номер
						</button>
					</div>

					{error && (
						<p
							style={{
								margin: "-16px 0 16px",
								fontSize: "13px",
								color: "#ef4444",
							}}>
							{error}
						</p>
					)}

					<label
						style={{
							display: "block",
							marginBottom: "8px",
							fontSize: "14px",
							fontWeight: 600,
							color: "#94a3b8",
							textTransform: "uppercase",
							letterSpacing: "0.05em",
						}}>
						Шаблон сообщения
					</label>
					<textarea
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						rows={10}
						style={{
							width: "100%",
							padding: "16px",
							fontSize: "14px",
							lineHeight: "1.6",
							background: "#0f172a",
							border: "1px solid #334155",
							borderRadius: "8px",
							color: "#f1f5f9",
							outline: "none",
							resize: "vertical",
							fontFamily: "inherit",
							boxSizing: "border-box",
							transition: "border-color 0.2s",
						}}
						onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
						onBlur={(e) => (e.target.style.borderColor = "#334155")}
					/>

					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: "12px",
							marginTop: "24px",
						}}>
						{(Object.keys(PLATFORMS) as Platform[]).map((platform) => {
							const config = PLATFORMS[platform];
							const isLoading = platform === "telegram" && tgLoading;
							return (
								<button
									key={platform}
									onClick={() => handleSend(platform)}
									disabled={isLoading}
									style={{
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										gap: "10px",
										padding: "14px 24px",
										fontSize: "15px",
										fontWeight: 600,
										background: config.color,
										color: "#ffffff",
										border: "none",
										borderRadius: "10px",
										cursor: isLoading ? "not-allowed" : "pointer",
										opacity: isLoading ? 0.7 : 1,
										transition:
											"transform 0.1s, background 0.2s, box-shadow 0.2s",
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
					</div>

					{tgToast && (
						<div
							style={{
								marginTop: "16px",
								padding: "12px 16px",
								borderRadius: "8px",
								fontSize: "13px",
								fontWeight: 500,
								background: tgToast.type === "success" ? "#14532d" : "#450a0a",
								color: tgToast.type === "success" ? "#86efac" : "#fca5a5",
								border: `1px solid ${tgToast.type === "success" ? "#166534" : "#7f1d1d"}`,
							}}>
							{tgToast.text}
						</div>
					)}

					<p
						style={{
							marginTop: "24px",
							fontSize: "12px",
							color: "#64748b",
							textAlign: "center",
							lineHeight: "1.5",
						}}>
						Откроет приложение в новой вкладке. Убедитесь, что WhatsApp,
						Telegram или Viber запущены.
					</p>
				</div>
			</div>
		</div>
	);
}

