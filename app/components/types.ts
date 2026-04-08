export type Platform = "whatsapp" | "telegram" | "viber";
export type Tab = "messenger" | "email";

export interface Params {
	bank: string;
	contract: string;
	debt: string;
	months: string;
	payment: string;
	date: string;
}

export interface TelegramToast {
	type: "success" | "error";
	text: string;
}

export interface PlatformConfig {
	label: string;
	color: string;
	hoverColor: string;
	icon: React.ReactNode;
}
