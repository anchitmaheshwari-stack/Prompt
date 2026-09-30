/** Top-level sections of the app, shared by the nav bar and the home page. */
export const SECTIONS = [
  {
    href: '/prompts',
    label: 'Prompt RCA',
    description: 'Root-cause analysis for the important AI prompts: visibility, fan-outs, sources and the lever to pull.',
  },
  {
    href: '/anatomy',
    label: 'Page anatomy',
    description: 'Side-by-side teardowns of a competitor page that AI cites and the Skydo page competing with it.',
  },
  {
    href: '/anatomy/playbook',
    label: 'Playbook',
    description: 'Every content bucket’s blueprint on one page: what winning pages do and what to change.',
  },
  {
    href: '/videos',
    label: 'Video tracker',
    description: 'How each AI-generated YouTube video performs, and whether it lifts the blog it sits on.',
  },
] as const;
