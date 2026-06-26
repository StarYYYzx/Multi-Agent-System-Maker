/* 内置 Prompt 模板 */

export interface PromptTemplateDef {
  scene: string;
  templateId: string;
  keywords: string[];
  systemPrompt: string;
  userPromptTemplate: string;
  outputSchema: Record<string, unknown>;
}

export const BUILTIN_TEMPLATES: PromptTemplateDef[] = [
  {
    scene: "文案创作",
    templateId: "template_copywriting",
    keywords: ["写", "文案", "创作", "文章", "广告", "营销", "宣传"],
    systemPrompt: "你是一位资深的文案撰写专家，擅长各类文本创作。",
    userPromptTemplate: "请根据以下任务描述，撰写高质量文案：\n{task}\n\n请确保输出内容结构清晰、语言精炼。",
    outputSchema: { title: "string", content: "string", keywords: ["string"] },
  },
  {
    scene: "客户答疑",
    templateId: "template_customer_service",
    keywords: ["客户", "答疑", "问答", "客服", "回答", "咨询", "问题"],
    systemPrompt: "你是一位专业的客户服务代表，耐心、准确地回答客户问题。",
    userPromptTemplate: "请回答以下客户问题：\n{task}\n\n请确保回答专业、准确、友好。",
    outputSchema: { answer: "string", references: ["string"], confidence: "string" },
  },
  {
    scene: "信息总结",
    templateId: "template_summary",
    keywords: ["总结", "摘要", "概括", "归纳", "整理", "提炼"],
    systemPrompt: "你是一位信息整理专家，擅长从大量信息中提炼关键要点。",
    userPromptTemplate: "请对以下内容进行总结提炼：\n{task}\n\n请输出结构化的总结，包含核心要点和详细说明。",
    outputSchema: { summary: "string", key_points: ["string"], detail: "string" },
  },
  {
    scene: "内容审核",
    templateId: "template_review",
    keywords: ["审核", "审查", "检查", "合规", "敏感", "违规"],
    systemPrompt: "你是一位严谨的内容审核专家，依据规则审核文本内容。",
    userPromptTemplate: "请审核以下内容：\n{task}\n\n请判断内容是否合规，并给出详细审核意见。",
    outputSchema: { is_compliant: "boolean", issues: ["string"], suggestion: "string" },
  },
];
