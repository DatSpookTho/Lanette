import { DefaultGameOption } from "../room-game";
import { Room } from "../rooms";
import { IGameFile } from "../types/games";
import { commands as templateCommands, Guessing } from './templates/guessing';

const name = "Greninja's Typings";
const data: {pokedex: string[], reverseTypes: Dict<string>, species: Dict<string>, types: Dict<string>} = {
	pokedex: [],
	reverseTypes: {},
	species: {},
	types: {},
};
let loadedData = false;

class GreninjasTypings extends Guessing {
	static loadData(room: Room) {
		if (loadedData) return;
		room.say("Loading data for " + name + "...");

		const pokedex = Dex.getPokemonList(x => !x.species.startsWith('Arcues-') && !x.species.startsWith('Silvally-'));
		for (let i = 0; i < pokedex.length; i++) {
			data.pokedex.push(pokedex[i].id);
			data.species[pokedex[i].id] = pokedex[i].species;
			data.reverseTypes[pokedex[i].id] = pokedex[i].types.slice().reverse().join('/');
			data.types[pokedex[i].id] = pokedex[i].types.join('/');
		}

		loadedData = true;
	}

	defaultOptions: DefaultGameOption[] = ['points'];
	lastPokemon: string = '';
	lastTyping: string = '';
	noOrder: boolean = false;

	onSignups() {
		if (this.options.freejoin) this.timeout = setTimeout(() => this.nextRound(), 5000);
	}

	async setAnswers() {
		let pokemon = this.sampleOne(data.pokedex);
		let typing = data.types[pokemon];
		let reverseTyping = data.reverseTypes[pokemon];
		while (!typing.includes('/') || typing === this.lastTyping || (this.noOrder && reverseTyping === this.lastTyping)) {
			pokemon = this.sampleOne(data.pokedex);
			typing = data.types[pokemon];
			reverseTyping = data.reverseTypes[pokemon];
		}
		const answers: string[] = [];
		for (let i = 0; i < data.pokedex.length; i++) {
			if (typing === data.types[data.pokedex[i]] || (this.noOrder && typing === data.reverseTypes[data.pokedex[i]])) {
				answers.push(data.species[data.pokedex[i]]);
			}
		}
		this.lastTyping = typing;
		this.answers = answers;
		this.hint = "Randomly generated typing: **" + typing + "**";
	}
}

export const game: IGameFile<GreninjasTypings> = {
	aliases: ['greninjas'],
	battleFrontierCategory: 'Knowledge',
	class: GreninjasTypings,
	commandDescriptions: [Config.commandCharacter + "g [Pokemon]"],
	commands: Object.assign({}, templateCommands),
	description: "Players guess Pokemon that match the given typing!",
	freejoin: true,
	formerNames: ['Typings'],
	name: "Greninja's Typings",
	mascot: "Greninja",
	modes: ["survival"],
	variants: [
		{
			name: "Greninja's No Order Typings",
			description: "Players guess Pokemon that match the given typing (order not important)!",
			noOrder: true,
			variant: "noorder",
		},
	],
};
