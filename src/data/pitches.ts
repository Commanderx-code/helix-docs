// Each tool's accent and one-line pitch, as on helixtech.app: the share
// cards use both, and a page with no intro of its own uses the pitch as its
// description
export const pitches: Record<string, { accent: string; text: string }> = {
  toolbox: { accent: '#3bd2ff', text: 'Set up and look after a Linux machine from one menu in the terminal.' },
  boot: { accent: '#c084fc', text: 'A multiboot rescue USB that builds itself from upstream sources.' },
  'webos-launcher': { accent: '#7fb4ff', text: 'A minimal home screen for LG webOS TVs.' },
  touchdown: { accent: '#79e4b7', text: 'Live NFL scores and stats in your terminal.' },
};
