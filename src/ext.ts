import * as flashpoint from 'flashpoint-launcher';
import * as DiscordRPC from 'discord-rpc';

const clientId = "732942533373460560"; 
let client: DiscordRPC.Client;

export async function activate(context: flashpoint.ExtensionContext) {
  const registerSub = (d: flashpoint.Disposable) => { flashpoint.registerDisposable(context.subscriptions, d)};
  let curActivity = createActivity();
  let curGame: flashpoint.Game | undefined = undefined;

  client = new DiscordRPC.Client({ transport: 'ipc' });
  client.on('ready', () => {
    flashpoint.log.debug('Discord RPC Connected!');
    setActivity(client, curActivity);
    setInterval(() => {
      setActivity(client, curActivity);
    }, 15000);
  });
  client.login({ clientId }).catch(flashpoint.log.error);

  flashpoint.games.onDidLaunchGame((game) => {
    if (!flashpoint.getExtConfigValue('com.discord-rich-presence.show-extreme') && flashpoint.games.isGameExtreme(game)) { return; }
    curActivity = createActivity(game);
    curGame = game;
  });

  flashpoint.services.onServiceRemove((process) => {
    if (process.id.startsWith('game.') && process.id.length > 5) {
      let closedId = process.id.substring(0, 5);
      if (curGame !== undefined && closedId === curGame.id) {
        curActivity = createActivity();
        curGame = undefined;
      }
    }
  })
}

export async function deactivative() {
  if (client) {
    flashpoint.log.debug('Shutting down Discord RPC Client');
    try {
      await client.destroy();
    } catch (err) {
      flashpoint.log.debug(`Error shutting down Discord RPC Client:\n${err}`);
    }
  }
}

async function setActivity(client: DiscordRPC.Client, activity: DiscordRPC.Presence) {
  return client.setActivity(activity);
}

function createActivity(game?: flashpoint.Game): DiscordRPC.Presence {
  if (game) {
    flashpoint.log.debug(`Game:\n ${JSON.stringify(game, null, 2)}`);
    const playing = game.library === 'arcade';
    const imageKey = playing ? 'game' : 'animation';
    const imageText = playing ? 'Game' : 'Animation';
    const owner = game.developer !== '' ? game.developer :
      game.publisher !== '' ? game.publisher : undefined;
    const state = owner ? formatOwners(owner) : game.platform;
    return { 
      details: game.title,
      state: state,
      startTimestamp: new Date(),
      largeImageKey: `logo_${game.platform.toLowerCase().replace(' ', '-')}`,
      largeImageText: game.platform,
      smallImageKey: imageKey,
      smallImageText: imageText,
      instance: false
    };
  } else {
    return {
      details: `Browsing The Archive`,
      startTimestamp: new Date(),
      largeImageKey: 'flashpoint',
      largeImageText: 'BlueMaxima\'s Flashpoint',
      instance: false
    };
  }
}

function formatOwners(owners: string) {
  const split = owners.split(';');
  if (split.length === 1) { 
    return `By ${owners}`;
  }
  if (split.length === 2) {
    return `By ${split[0].trim()} & ${split[1].trim()}`; 
  }
  return `By ${split[0].trim()} & ${split.length - 1} Others`;
}
