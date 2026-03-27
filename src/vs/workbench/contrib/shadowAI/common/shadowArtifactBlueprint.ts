/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type ShadowArtifactKind = 'presentation' | 'document' | 'spreadsheet';

export function createShadowArtifactBlueprint(kind: ShadowArtifactKind, prompt: string): string {
	const trimmedPrompt = prompt.trim() || 'Untitled Artifact';
	const now = new Date().toISOString();

	switch (kind) {
		case 'presentation':
			return [
				`artifact: presentation`,
				`title: ${trimmedPrompt}`,
				`theme: neo-minimal`,
				`createdAt: ${now}`,
				``,
				`slide: Opening`,
				`layout: hero`,
				`content:`,
				`- Hook statement`,
				`- Audience outcome`,
				``,
				`slide: Problem`,
				`layout: split`,
				`content:`,
				`- Key pain points`,
				`- Evidence snapshot`,
				``,
				`slide: Solution`,
				`layout: process`,
				`content:`,
				`- Approach summary`,
				`- Benefits and tradeoffs`,
				``,
				`slide: Next Steps`,
				`layout: checklist`,
				`content:`,
				`- Execution plan`,
				`- Success metrics`
			].join('\n');
		case 'document':
			return [
				`artifact: document`,
				`title: ${trimmedPrompt}`,
				`style: executive-brief`,
				`createdAt: ${now}`,
				``,
				`section: Summary`,
				`text: 3-5 sentence overview.`,
				``,
				`section: Context`,
				`text: Explain background and constraints.`,
				``,
				`section: Recommendation`,
				`text: Proposed path with rationale.`,
				``,
				`section: Risks`,
				`text: Key risks and mitigations.`,
				``,
				`section: Decision`,
				`text: Final ask or decision checkpoint.`
			].join('\n');
		case 'spreadsheet':
			return [
				`artifact: spreadsheet`,
				`title: ${trimmedPrompt}`,
				`createdAt: ${now}`,
				``,
				`sheet: Data`,
				`columns: id:text, name:text, amount:number, status:text, createdAt:date`,
				``,
				`sheet: Metrics`,
				`cells:`,
				`- A1 = \"Total Amount\"`,
				`- B1 = \"=SUM(Data!C:C)\"`,
				`- A2 = \"Open Count\"`,
				`- B2 = \"=COUNTIF(Data!D:D, \\\"open\\\")\"`,
				``,
				`sheet: Dashboard`,
				`widgets: kpi(totalAmount), kpi(openCount), chart(monthlyAmount)`
			].join('\n');
	}
}
