import { ICommandDefinition } from "../command-parser";
import { Player } from "../room-activity";
import { Game } from "../room-game";
import { Room } from "../rooms";
import { IGameFile } from "../types/games";
import { User } from "../users";

const GRID_SIZE = 4;

const name = "Trevenant's Trick-or-Treat";
const data: {allPossibleMoves: Dict<readonly string[]>, pokedex: string[]} = {
	allPossibleMoves: {},
	pokedex: [],
};
let loadedData = false;

class TrevenantsTrickOrTreat extends Game {
	static loadData(room: Room) {
		if (loadedData) return;
		room.say("Loading data for " + name + "...");

		const pokedex = Dex.getPokemonList(x => !x.forme && Dex.hasGifData(x, 'bw'));
		for (let i = 0; i < pokedex.length; i++) {
			const pokemon = pokedex[i];
			data.pokedex.push(pokemon.id);
			data.allPossibleMoves[pokemon.id] = pokemon.allPossibleMoves;
		}

		loadedData = true;
	}

	pokemonList: string[];

	points = new Map<Player, number>();
	pokemonGrid: string[][] = [];
	hasAnswered = new Set<Player>();
	indicesToReplace = new Set();
	timeout: NodeJS.Timer | null = null;

	constructor(room: Room | User) {
		super(room);

		this.pokemonList = this.shuffle(data.pokedex);
	}

	generateNewMons() {
		this.pokemonGrid = [];
		for (let i = 0; i < GRID_SIZE; i++) {
			this.pokemonGrid.push([]);
			for (let j = 0; j < GRID_SIZE; j++) {
				this.pokemonGrid[i].push(this.getNextMon());
			}
		}
	}

	getNextMon(): string {
		if (!this.pokemonList.length) this.pokemonList = this.shuffle(data.pokedex);
		return this.pokemonList.shift()!;
	}

	onSignups() {
		this.options.points = 500;
		this.say("Use ``" + Config.commandCharacter + "trick [move]`` in PMs to guess moves only one Pokemon in the grid can learn.");
		this.generateNewDisplay();
		this.timeout = setTimeout(() => this.generateNewDisplay(), 60 * 1000);
	}

	generateNewDisplay() {
		this.generateNewMons();
		this.display();
	}

	display() {
		let html = `<div class="infobox"><center>`;
		for (let i = 0; i < GRID_SIZE; i++) {
			for (let j = 0; j < GRID_SIZE; j++) {
				html += Dex.getPokemonGif(Dex.getExistingPokemon(this.pokemonGrid[i][j]), "bw");
			}
			html += "<br />";
		}
		html += "<br /><br />" + this.getPlayerPoints() + "</center></div>";
		this.sayUhtml(this.uhtmlBaseName + '-round-pokemon', html);
	}
}

const commands: Dict<ICommandDefinition<TrevenantsTrickOrTreat>> = {
	trick: {
		command(target, room, user) {
			if (!this.started || (user.id in this.players && this.players[user.id].eliminated)) return;
			const move = Dex.getMove(target);
			if (!move) return user.say("'" + target + "' is not a valid move.");
			const player = this.createPlayer(user) || this.players[user.id];
			this.hasAnswered.add(player);
			const indices: [number, number][] = [];
			for (let i = 0; i < GRID_SIZE; i++) {
				for (let j = 0; j < GRID_SIZE; j++) {
					const pokemon = Dex.getExistingPokemon(this.pokemonGrid[i][j]);
					let learnsMove = pokemon.learnset ? move.id in pokemon.learnset : false;
					if (!learnsMove) {
						let evolution = pokemon;
						while (evolution.prevo) {
							evolution = Dex.getExistingPokemon(evolution.prevo);
							learnsMove = evolution.learnset ? move.id in evolution.learnset : false;
							if (learnsMove) break;
						}
					}
					if (pokemon.forme) {
						const baseSpecies = Dex.getExistingPokemon(pokemon.baseSpecies);
						if (baseSpecies.learnset && move.id in baseSpecies.learnset) learnsMove = false;
					}
					if (learnsMove) {
						indices.push([i, j]);
					}
				}
			}

			if (!indices.length) {
				return player.say("**" + move.name + "** isn't learned by any Pokemon in the grid!");
			}

			if (indices.length > 1) {
				return player.say("**" + move.name + "** is learned by more than 1 Pokemon  (" + Tools.joinList(indices.map(index => this.pokemonGrid[index[0]][index[1]])) + ").");
			}

			const points = this.points.get(player) || 0;
			let earnedPoints = 0;
			for (let i = 0; i < data.pokedex.length; i++) {
				if (data.allPossibleMoves[data.pokedex[i]].includes(move.id)) earnedPoints++;
			}
			const totalPoints = points + earnedPoints;
			this.points.set(player, totalPoints);
			player.say("You earned **" + earnedPoints + "** points for " + move.name + "! Your total is now **" + totalPoints + "**.");
			if (totalPoints >= this.options.points) {
				this.say("**Winner**: " + player.name);
				this.winners.set(player, totalPoints);
				for (const i in this.players) {
					const player = this.players[i];
					const points = this.points.get(player);
					if (points && !player.eliminated) this.addBits(player, points);
				}
				return this.end();
			}
			this.pokemonGrid[indices[0][0]][indices[0][1]] = this.getNextMon();
			this.display();
			if (this.timeout) clearTimeout(this.timeout);
			this.timeout = setTimeout(() => this.generateNewDisplay(), 60 * 1000);
		},
		pmGameCommand: true,
	},
};

export const game: IGameFile<TrevenantsTrickOrTreat> = {
	aliases: ["trevenants", "ttt", "trickortreat"],
	battleFrontierCategory: 'Knowledge',
	commandDescriptions: [Config.commandCharacter + "trick [move]"],
	commands,
	class: TrevenantsTrickOrTreat,
	description: "Players guess moves learned by only one Pokemon on the grid, gaining points equal to the total number of pokemon that learn that move. The grid is constantly updating, so beware!",
	freejoin: true,
	name,
	mascot: "Trevenant",
	scriptedOnly: true,
};
