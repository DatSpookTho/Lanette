import { PRNG, PRNGSeed } from "../prng";
import { DefaultGameOption, IGameOptionValues } from "../room-game";
import { Room } from "../rooms";
import { IGameFile } from "../types/games";
import * as ParametersWorker from './../workers/parameters';
import { commandDescriptions, commands as templateCommands, Guessing } from './templates/guessing';

const name = "Paras' Parameters";
let loadedData = false;

export class ParasParameters extends Guessing {
	static loadData(room: Room) {
		if (loadedData) return;
		room.say("Loading data for " + name + "...");

		ParametersWorker.init();

		loadedData = true;
	}

	baseNumberOfParams: number = 2;
	currentNumberOfParams: number = 0;
	customizableOptions: Dict<IGameOptionValues> = {
		params: {min: 2, base: 2, max: 4},
	};
	customParamTypes: ParametersWorker.ParamType[] | null = null;
	defaultOptions: DefaultGameOption[] = ['points'];
	htmlHint = true;
	minimumResults: number = 3;
	maximumResults: number = 50;
	params: ParametersWorker.IParam[] = [];
	paramTypes: ParametersWorker.ParamType[] = ['move', 'tier', 'color', 'type', 'resistance', 'weakness', 'egggroup', 'ability', 'gen'];
	pokemon: string[] = [];
	roundTime: number = 5 * 60 * 1000;

	getParamNames(params: ParametersWorker.IParam[]): string {
		const names = [];
		for (let i = 0; i < params.length; i++) {
			if (params[i].type === 'type') {
				names.push(params[i].param + ' type');
			} else if (params[i].type === 'resistance') {
				names.push('Resists ' + params[i].param + ' type');
			} else if (params[i].type === 'weakness') {
				names.push('Weak to ' + params[i].param + ' type');
			} else if (params[i].type === 'gen') {
				names.push("Gen " + params[i].param);
			} else if (params[i].type === 'egggroup') {
				names.push(params[i].param + " Group");
			} else {
				names.push(params[i].param);
			}
		}
		return Tools.joinList(names.sort());
	}

	async setAnswers() {
		let numberOfParams: number;
		if (this.customParamTypes) {
			numberOfParams = this.customParamTypes.length;
		} else if (this.inputOptions.params) {
			numberOfParams = this.options.params;
		} else {
			numberOfParams = this.baseNumberOfParams;
			if (this.customizableOptions.params) numberOfParams += this.random(3);
		}
		this.currentNumberOfParams = numberOfParams;
		const result = await ParametersWorker.search({
			customParamTypes: this.customParamTypes,
			minimumResults: this.minimumResults,
			maximumResults: this.maximumResults,
			mod: Dex.currentGenString,
			numberOfParams,
			paramTypes: this.paramTypes,
			prngSeed: this.prng.seed.slice() as PRNGSeed,
			searchType: 'pokemon',
		});

		if (this.ended) return;

		if (!result.pokemon.length) {
			this.say("Invalid params specified.");
			this.deallocate();
		} else {
			this.answers = [this.getParamNames(result.params)];
			this.params = result.params;
			this.pokemon = result.pokemon;
			this.hint = this.getParamsHtml(this.params, this.pokemon);
			this.prng = new PRNG(result.prngSeed);
		}
	}

	getParamsHtml(params: ParametersWorker.IParam[], pokemon: string[]) {
		let oldGen = '';
		if (this.options.gen && this.options.gen !== Dex.gen) oldGen = " (Generation " + this.options.gen + ")";
		let html = "<div class='infobox'><span style='color: #999999'>" + params.length + " params" + oldGen + ":</span><br />";
		const pokemonIcons: string[] = [];
		for (let i = 0; i < pokemon.length; i++) {
			pokemonIcons.push('<psicon pokemon="' + pokemon[i] + '" style="vertical-align: -7px;margin: -2px" />' + Dex.getExistingPokemon(pokemon[i]).species);
		}
		html += pokemonIcons.join(", ") + "</div>";
		return html;
	}

	getAnswers(givenAnswer: string, finalAnswer?: boolean): string {
		if (!givenAnswer) givenAnswer = this.answers[0];
		return "A possible set of parameters was __" + givenAnswer + "__.";
	}

	async intersect(params: string[]): Promise<ParametersWorker.IParameterIntersectResult> {
		return ParametersWorker.intersect({
			mod: Dex.currentGenString,
			paramTypes: this.paramTypes,
			searchType: 'pokemon',
		}, params);
	}

	async checkAnswer(guess: string): Promise<string> {
		const parts = guess.split(',');
		if (parts.length === this.currentNumberOfParams) {
			const intersection = await this.intersect(parts);
			if (intersection.pokemon.join(',') === this.pokemon.join(',')) return Promise.resolve(this.getParamNames(intersection.params));
		}
		return Promise.resolve("");
	}
}

export const game: IGameFile<ParasParameters> = {
	aliases: ['paras', 'params'],
	battleFrontierCategory: 'Puzzle',
	class: ParasParameters,
	commandDescriptions,
	commands: Object.assign({}, templateCommands),
	description: "Players search for possible <code>/dexsearch</code> parameters that result in the given Pokemon list!",
	formerNames: ["Parameters"],
	freejoin: true,
	name,
	mascot: "Paras",
	minigameCommand: 'parameter',
	minigameCommandAliases: ['param'],
	minigameDescription: "Use ``/ds`` to verify and then ``" + Config.commandCharacter + "g`` to guess ``/ds`` parameters that give the following Pokemon!",
	variants: [
		{
			name: "Paras' Parameters Survival",
			paramTypes: ['tier', 'color', 'type', 'egggroup', 'ability', 'gen'],
			mode: 'survival',
			variant: "survival",
		},
	],
	workers: [ParametersWorker],
};
