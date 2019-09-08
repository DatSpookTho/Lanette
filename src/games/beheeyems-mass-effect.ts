import { DefaultGameOption } from "../room-game";
import { Room } from "../rooms";
import { IGameFile } from "../types/games";
import { commandDescriptions, commands as templateCommands, Guessing } from "./templates/guessing";

const name = "Beheeyem's Mass Effect";
const data: {types: Dict<string[]>} = {
	types: {},
};
const effectivenessLists: Dict<string[]> = {};
const effectivenessListsKeys: string[] = [];
let loadedData = false;

class BeheeyemsMassEffect extends Guessing {
	static loadData(room: Room) {
		if (loadedData) return;
		room.say("Loading data for " + name + "...");

		const pokemonList = Dex.getPokemonList();
		for (let i = 0; i < pokemonList.length; i++) {
			const pokemon = pokemonList[i];
			const typing = pokemon.types.slice().sort().join('/');
			if (!(typing in data.types)) data.types[typing] = [];
			data.types[typing].push(pokemon.species);
		}

		for (const typing in data.types) {
			const immunities: string[] = [];
			const resistances: string[] = [];
			const weaknesses: string[] = [];
			const typingArray = typing.split('/');
			for (const type in Dex.data.typeChart) {
				if (Dex.isImmune(type, typingArray)) {
					immunities.push(type);
				} else {
					const effectiveness = Dex.getEffectiveness(type, typingArray);
					if (effectiveness <= -2) {
						resistances.push("**" + type + "**");
					} else if (effectiveness === -1) {
						resistances.push(type);
					} else if (effectiveness === 1) {
						weaknesses.push(type);
					} else if (effectiveness >= 2) {
						weaknesses.push("**" + type + "**");
					}
				}
			}
			const text: string[] = [];
			if (weaknesses.length) text.push("``Weaknesses`` " + weaknesses.join(", "));
			if (resistances.length) text.push("``Resistances`` " + resistances.join(", "));
			if (immunities.length) text.push("``Immunities`` " + immunities.join(", "));
			const effectiveness = text.join(" | ");
			if (!(effectiveness in effectivenessLists)) {
				effectivenessLists[effectiveness] = [];
				effectivenessListsKeys.push(effectiveness);
			}
			for (let i = 0; i < data.types[typing].length; i++) {
				const pokemon = data.types[typing][i];
				if (!effectivenessLists[effectiveness].includes(pokemon)) effectivenessLists[effectiveness].push(pokemon);
			}
		}

		loadedData = true;
	}

	defaultOptions: DefaultGameOption[] = ['points'];
	lastEffectiveness: string = '';

	onSignups() {
		if (this.options.freejoin) {
			this.timeout = setTimeout(() => this.nextRound(), 10 * 1000);
		}
	}

	async setAnswers() {
		let effectiveness = this.sampleOne(effectivenessListsKeys);
		while (effectiveness === this.lastEffectiveness) {
			effectiveness = this.sampleOne(effectivenessListsKeys);
		}
		this.lastEffectiveness = effectiveness;
		this.answers = effectivenessLists[effectiveness];
		this.hint = "Randomly generated effectiveness: " + effectiveness;
	}
}

export const game: IGameFile<BeheeyemsMassEffect> = {
	aliases: ["Beheeyems", "bme"],
	battleFrontierCategory: 'Knowledge',
	commandDescriptions,
	commands: Object.assign({}, templateCommands),
	class: BeheeyemsMassEffect,
	description: "Each round, players find a Pokemon whose type effectiveness matches the given parameters.",
	formerNames: ["Mass Effect"],
	freejoin: true,
	name,
	mascot: "Beheeyem",
	modes: ['survival'],
};
