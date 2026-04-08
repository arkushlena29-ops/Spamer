import PhoneInput from "../PhoneInput";
import MessageParams from "../MessageParams";
import MessageTemplate from "../MessageTemplate";
import SendButtons from "../SendButtons";
import type { Params, Platform, TelegramToast } from "../types";

interface Props {
	phone: string;
	error: string | null;
	onPhoneChange: (value: string) => void;
	onPhoneClear: () => void;
	params: Params;
	onParamChange: (key: keyof Params, value: string) => void;
	message: string;
	onMessageChange: (value: string) => void;
	onSend: (platform: Platform) => void;
	tgLoading: boolean;
	toast: TelegramToast | null;
}

export default function MessengerTab({
	phone,
	error,
	onPhoneChange,
	onPhoneClear,
	params,
	onParamChange,
	message,
	onMessageChange,
	onSend,
	tgLoading,
	toast,
}: Props) {
	return (
		<div
			style={{
				flex: 1,
				display: "grid",
				gridTemplateColumns: "1fr 1fr",
				gap: "24px",
				padding: "24px 32px",
				overflow: "hidden",
			}}>
			{/* Left column */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "20px",
					overflow: "hidden",
				}}>
				<PhoneInput
					value={phone}
					error={error}
					onChange={onPhoneChange}
					onClear={onPhoneClear}
				/>
				<MessageParams params={params} onChange={onParamChange} />
			</div>

			{/* Right column */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "16px",
					overflow: "hidden",
				}}>
				<MessageTemplate value={message} onChange={onMessageChange} />
				<SendButtons onSend={onSend} tgLoading={tgLoading} toast={toast} />
			</div>
		</div>
	);
}
