const ytSearch = require('youtube-search');
const { buildAuthorization, getGameExtended } = require('@retroachievements/api');

const Command = require('../../structures/Command');

const { YOUTUBE_API_KEY, RA_USER, RA_WEB_API_KEY } = process.env;
const opts = {
  maxResults: 1,
  key: YOUTUBE_API_KEY,
};

module.exports = class GenerateAchievementNewsCommand extends Command {
  constructor(client) {
    super(client, {
      name: 'genachnews',
      aliases: ['gan'],
      group: 'rautil',
      memberName: 'genachnews',
      description: 'Generate an achievement-news post template for the given game ID',
      examples: ['`achnews 4650`'],
      throttling: {
        usages: 3,
        duration: 60,
      },
      args: [
        {
          key: 'gameId',
          prompt: '',
          type: 'string',
          validate: (arg) => {
            if (Number.parseInt(arg, 10) > 0) {
              return true;
            }
            return /^https?:\/\/retroachievements\.org\/game\/[0-9]+$/i.test(arg);
          },
        },
      ],
    });
  }

  async getLongplayLink(terms) {
    const searchTerms = `longplay ${terms}`;

    const { results } = await ytSearch(searchTerms, opts);

    return results[0] ? results[0].link : null;
  }

  async getGameInfo(gameId) {
    let gameInfo = null;

    try {
      const authorization = buildAuthorization({
        userName: RA_USER,
        webApiKey: RA_WEB_API_KEY,
      });

      const gameExtended = await getGameExtended(authorization, { gameId });

      const dates = new Set();

      for (const achievement of Object.values(gameExtended.achievements)) {
        dates.add(achievement.dateModified.replace(/ ..:..:..$/, ''));
      }

      const achievementSetDate = [...dates].reduce((d1, d2) => {
        const date1 = new Date(d1);
        const date2 = new Date(d2);
        return date1 >= date2 ? d1 : d2;
      });

      gameInfo = {
        id: gameId,
        title: gameExtended.title,
        consoleName: gameExtended.consoleName,
        genre: gameExtended.genre,
        developer: gameExtended.developer,
        releaseDate: gameExtended.released,
        achievementSetDate,
      };
    } catch (error) {
      return null;
    }

    return gameInfo;
  }

  async run(msg, { gameId }) {
    let id = Number.parseInt(gameId, 10);
    if (Number.isNaN(id)) {
      id = /[0-9]+$/.exec(gameId);
    }

    const sentMsg = await msg.say(
      `:hourglass: Getting info for game ID \`${id}\`, please wait...`,
    );

    const gameInfo = await this.getGameInfo(id);
    if (!gameInfo) {
      return sentMsg.edit(`Unable to get info from the game ID \`${id}\`... :frowning:`);
    }

    const youtubeLink = await this.getLongplayLink(
      `${gameInfo.title.replace(/~/g, '')} ${gameInfo.consoleName}`,
    );

    const template = `
\\\`\\\`\\\`md
\`\`\`md
< ${gameInfo.title} >
[${gameInfo.consoleName}, ${gameInfo.genre}](${gameInfo.developer})< ${gameInfo.releaseDate} >
\`\`\`\\\`\\\`\\\`
A new set was published by @{AUTHOR_NAME} on ${gameInfo.achievementSetDate}
${youtubeLink || '{LONGPLAY-LINK}'}
<https://retroachievements.org/game/${id}>
`;

    return sentMsg.edit(`${msg.author}, here's your achievement-news post template:\n${template}`);
  }
};
