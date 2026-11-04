import type { IReportsService } from "@tweety/proto";
import { validateSessionToken } from "../../middleware/auth";
import { createReport } from "../../services/reports.service";
import { withObservability } from "../observability";

export const reportsHandler: IReportsService = {
	createReport: withObservability("ReportsService/createReport", async (request) => {
		try {
			const auth = validateSessionToken(request.sessionToken);
			const { id } = await createReport(auth.userId, {
				targetType: request.targetType,
				targetId: request.targetId,
				reason: request.reason,
				description: request.description,
			});
			return { success: true, reportId: id };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Failed to submit report",
			};
		}
	}),
};
