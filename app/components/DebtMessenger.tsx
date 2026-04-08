"use client";

import { useState, useCallback, useRef } from "react";
import AppHeader from "./AppHeader";
import MessengerTab from "./messenger/MessengerTab";
import EmailTab from "./email/EmailTab";
import { buildMessage, cleanPhone, buildUri, DEFAULT_PARAMS } from "./constants";
import type { Tab, Platform, Params, TelegramToast } from "./types";

export default function DebtMessenger() {
	const [activeTab, setActiveTab] = useState<Tab>("messenger");
	const [phone, setPhone] = useState("");
	const [message, setMessage] = useState(() => buildMessage(DEFAULT_PARAMS));
	const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
	const [error, setError] = useState<string | null>(null);
	const [tgLoading, setTgLoading] = useState(false);
	const [tgToast, setTgToast] = useState<TelegramToast | null>(null);
	const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleParamChange = useCallback((key: keyof Params, newVal: string) => {
		setParams((prev) => {
			const next = { ...prev, [key]: newVal };
			setMessage(buildMessage(next));
			return next;
		});
	}, []);

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

			window.open(buildUri(platform, cleaned, message), "_blank");
		},
		[phone, message],
	);

	const handlePhoneChange = (value: string) => {
		setPhone(value);
		setError(null);
	};

	const handlePhoneClear = () => {
		setPhone("");
		setError(null);
	};

	return (
		<div
			style={{
				height: "100vh",
				overflow: "hidden",
				background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
				display: "flex",
				flexDirection: "column",
				fontFamily:
					'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
			}}>
			<AppHeader activeTab={activeTab} onTabChange={setActiveTab} />

			{activeTab === "email" ? (
				<EmailTab />
			) : (
				<MessengerTab
					phone={phone}
					error={error}
					onPhoneChange={handlePhoneChange}
					onPhoneClear={handlePhoneClear}
					params={params}
					onParamChange={handleParamChange}
					message={message}
					onMessageChange={setMessage}
					onSend={handleSend}
					tgLoading={tgLoading}
					toast={tgToast}
				/>
			)}
		</div>
	);
}
