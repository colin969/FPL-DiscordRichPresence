import * as flashpoint from 'flashpoint-launcher';
import * as DiscordRPC from 'discord-rpc';

const clientId = "732942533373460560"; 
let client: DiscordRPC.Client;

export async function activate(context: flashpoint.ExtensionContext) {
  const registerSub = (d: flashpoint.Disposable) => { flashpoint.registerDisposable(context.subscriptions, d)};
  let curActivity = createActivity();
  let curGame: flashpoint.Game | undefined = undefined;

  try {
    client = new DiscordRPC.Client({ transport: 'ipc' });
    client.on('ready', () => {
      flashpoint.log.debug('Discord RPC Connected!');
      setActivity(client, curActivity);
      setInterval(() => {
        setActivity(client, curActivity);
      }, 15000);
    });
    client.on('error', (err) => {
      flashpoint.log.error(err);
    });
    client.login({ clientId }).catch(flashpoint.log.error);

    registerSub(flashpoint.games.onDidLaunchGame((game) => {
      if (!flashpoint.getExtConfigValue('com.discord-rich-presence.show-extreme') && flashpoint.games.isGameExtreme(game)) { return; }
      curActivity = createActivity(game);
      curGame = game;
    }));

    registerSub(flashpoint.services.onServiceRemove((process) => {
      if (process.id.startsWith('game.') && process.id.length > 5) {
        let closedId = process.id.substring(5);
        if (curGame !== undefined && closedId === curGame.id) {
          curActivity = createActivity();
          curGame = undefined;
        }
      }
    }));
  } catch (err) {
    flashpoint.log.error(`Error initializing Discord RPC Client:\n${err}`);
  }
}

export async function deactivate() {
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
  return client.setActivity(activity).catch((err) => {
    flashpoint.log.error(`Error setting Discord Activity:\n${err}`);
  });
}

function createActivity(game?: flashpoint.Game): DiscordRPC.Presence {
  if (game) {
    const playing = game.library === 'arcade';
    const imageKey = playing ? 'game' : 'animation';
    const imageText = playing ? 'Game' : 'Animation';
    const owner = game.developer !== '' ? game.developer :
      game.publisher !== '' ? game.publisher : undefined;
    const platform = game.platforms.length > 0 ?
      game.platforms[0] :
      'No Platform';
    const state = owner ? formatOwners(owner) : platform;
    return { 
      details: ensureStringLength(game.title),
      state: ensureStringLength(state),
      startTimestamp: new Date(),
      largeImageKey: `logo_${platform.toLowerCase().replace(' ', '-')}`,
      largeImageText: platform,
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

// Strings passed to Discord must have a length of 2 to 128 characters (inclusive)
// But let's limit it to 64 characters just to be safe
function ensureStringLength(str: string) {
  const minLength = 2;
  const maxLength = 64;
  if (str.length > maxLength) {
    return str.substring(0, maxLength - 1) + '…';
  } else {
    return str.padEnd(minLength);
  }
}
