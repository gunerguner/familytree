// 人物资料字段的唯一清单：详情面板展示与表单录入共用，加字段只改这里
export interface PersonFieldDesc {
  key: 'kinship' | 'formerName' | 'nickname' | 'birthText' | 'deathText' | 'narrative';
  label: string;
  placeholder?: string;
  textarea?: boolean;
}

export const PERSON_FIELDS: PersonFieldDesc[] = [
  { key: 'kinship', label: '称谓' },
  { key: 'formerName', label: '原名' },
  { key: 'nickname', label: '小名' },
  { key: 'birthText', label: '出生', placeholder: '按资料原文填写，例如 1900.2.18 或 正月十九' },
  { key: 'deathText', label: '卒于', placeholder: '按资料原文填写，例如 1900.2.18 或 正月十九' },
  { key: 'narrative', label: '记述', textarea: true },
];
