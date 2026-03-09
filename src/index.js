import { ApiClient } from "./api.js";
import { createContent } from "./text.js";

const { GH_TOKEN, GIST_ID, USERNAME } = process.env;

(async () => {
  try {
    if (!GH_TOKEN) throw new Error("GH_TOKEN is not provided.");
    if (!GIST_ID) throw new Error("GIST_ID is not provided.");
    if (!USERNAME) throw new Error("USERNAME is not provided.");

    const api = new ApiClient(GH_TOKEN);
    console.log(`username is ${USERNAME}.`);

    // GraphQL로 유저의 모든 레포 언어 통계 가져오기
    const query = `{
      user(login: "${USERNAME}") {
        repositories(first: 100, ownerAffiliations: OWNER, orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes {
            name
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
              edges {
                size
                node { name }
              }
            }
          }
        }
      }
    }`;

    const result = await api.fetchGq(query);
    const repos = result.data.user.repositories.nodes;
    console.log(`${repos.length} repositories found.`);

    // 언어별 바이트 합산
    const langMap = {};
    for (const repo of repos) {
      for (const edge of repo.languages.edges) {
        const name = edge.node.name;
        langMap[name] = (langMap[name] || 0) + edge.size;
      }
    }

    // 정렬 + 퍼센트 계산
    const total = Object.values(langMap).reduce((a, b) => a + b, 0);
    const langs = Object.entries(langMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, size]) => ({
        name,
        percent: (size / total) * 100,
        additions: size,
        deletions: 0,
        count: 1,
      }));

    console.log(`\nLanguages:`);
    langs.forEach(l => console.log(`  ${l.name}: ${l.percent.toFixed(1)}%`));

    const content =
      langs.length > 0
        ? createContent(langs)
        : "No language data available yet.";
    console.log(`\n${content}\n`);

    const gist = await api.fetch(`/gists/${GIST_ID}`);
    const filename = Object.keys(gist.files)[0];
    await api.fetch(`/gists/${GIST_ID}`, "PATCH", {
      files: {
        [filename]: {
          filename: `💻 Most used languages`,
          content,
        },
      },
    });

    console.log(`Update succeeded.`);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
})();
