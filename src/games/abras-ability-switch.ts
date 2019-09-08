import { DefaultGameOption } from "../room-game";
import { Room } from "../rooms";
import { IGameFile } from "../types/games";
import { commands as templateCommands, Guessing } from './templates/guessing';

const name = "Abra's Ability Switch";
const data: {abilities: Dict<string[]>, pokedex: string[]} = {
	"abilities": {},
	"pokedex": [],
};
let loadedData = false;

class AbrasAbilitySwitch extends Guessing {
	static loadData(room: Room) {
		if (loadedData) return;
		room.say("Loading data for " + name + "...");

		const pokedex = Dex.getPokemonList();
		for (let i = 0; i < pokedex.length; i++) {
			const pokemon = pokedex[i];
			const abilities: string[] = [];
			for (const i in pokemon.abilities) {
				// @ts-ignore
				abilities.push(pokemon.abilities[i]);
			}
			data.abilities[pokemon.id] = abilities;
			data.pokedex.push(pokedex[i].species);
		}

		loadedData  = true;
	}

	defaultOptions: DefaultGameOption[] = ['points'];
	lastAbility: string = '';
	lastPokemon: string = '';

	async setAnswers() {
		let pokemon = this.sampleOne(data.pokedex);
		while (pokemon === this.lastPokemon) {
			pokemon = this.sampleOne(data.pokedex);
		}
		this.lastPokemon = pokemon;

		const id = Tools.toId(pokemon);
		let ability = this.sampleOne(data.abilities[id]);
		while (ability === this.lastAbility) {
			if (data.abilities[id].length === 1) {
				this.setAnswers();
				return;
			}
			ability = this.sampleOne(data.abilities[id]);
		}
		this.lastAbility = ability;

		const answers: string[] = [];
		for (let i = 0; i < data.pokedex.length; i++) {
			if (data.abilities[Tools.toId(data.pokedex[i])].includes(ability)) {
				answers.push(data.pokedex[i]);
			}
		}
		this.answers = answers;
		this.hint = "Abra wants the ability **" + ability + "**!";
	}
}

const commands = Tools.deepClone(templateCommands);
commands.guess.aliases!.push('switch');

export const game: IGameFile<AbrasAbilitySwitch> = {
	aliases: ['aas', 'abras'],
	battleFrontierCategory: 'Knowledge',
	class: AbrasAbilitySwitch,
	commandDescriptions: [Config.commandCharacter + "switch [Pokemon]"],
	commands,
	description: "Players switch to Pokemon that have the chosen abilities for Abra to Role Play!",
	freejoin: true,
	name,
	mascot: "Abra",
	modes: ["survival"],
};
