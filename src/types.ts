export interface JiraStory {
  key: string;
  fields: {
    summary: string;
    description: any;
    status: {
      name: string;
    };
    issuetype: {
      name: string;
    };
    priority: {
      name: string;
    };
    reporter: {
      displayName: string;
    };
  };
}

export interface PlaywrightScriptItem {
  id: string;
  title: string;
  script: string;
}
