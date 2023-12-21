const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const winston = require('winston');

// init logger
const logger = winston.createLogger({
	level: process.env.LOG_LEVEL,
	format: winston.format.simple(),
	transports: [new winston.transports.Console()],
})

async function build() {
	try {
		// retrieve menu list.
		// TODO: menus database name as input.
		// menus database id
		const databaseId = 'dba2b39a6cb74962a01c998c9c78e229';
		const targetMenu = process.argv[2]
		logger.debug(JSON.stringify({ 'targetMenu': targetMenu, 'databaseId': databaseId }))
		results = {}
		results.menus = await notion.databases.query({ database_id: databaseId, });
		// list first menu blocks.
		results.selected_menu_id = results.menus.results.filter(db => db.properties.Name.title[0]?.plain_text == targetMenu)[0].id;
		results.first_menu_blocks = await notion.blocks.children.list({ block_id: results.selected_menu_id });
		// read the day-meal-recipes database.
		results.first_menu_db = await notion.databases.query({ database_id: results.first_menu_blocks.results[0].id });
		// build day-pranzo/cena map.
		results['day-pranzo/cena'] = await Promise.all(reduceObject(results.first_menu_db, ['results'])
			.results.map(result => reduceObject(result, 'properties'))
			.map(async day => {
				return {
					day: day.properties.Name.title[0]?.plain_text,
					pranzo: await getCourses(day, 'Pranzo'),
					cena: await getCourses(day, 'Cena')
				}
			}))
		// extract all ingredients.
		results.grocery_list = []
		// add all ingredients.
		results['day-pranzo/cena'].forEach(day => {
			day.pranzo.forEach(recipe => results.grocery_list.push(recipe.ingredients.map(ingredient => ingredient.ingredientName)))
			day.cena.forEach(recipe => results.grocery_list.push(recipe.ingredients.map(ingredient => ingredient.ingredientName)))
		})
		// flatten and remove duplicates, null values.
		results.grocery_list = [...new Set(results.grocery_list.flat())]
		console.log(results.grocery_list.slice(1, -1).join("\n"))
	} catch (e) {
		console.log("Failed", e)
	} finally {
		if (Boolean(process.env.DEBUG)) {
			console.log(JSON.stringify(results, null, 2))
		}
	}
}

// given the name of a meal, retrieve its courses.
async function getCourses(day, meal) {
	return await Promise.all(day.properties[meal].relation.map(async relation =>
		await notion.blocks.retrieve({ block_id: relation.id }).then(async (result) => {
			return {
				recipeName: result.child_page.title,
				ingredients: await getIngredients(relation.id)
			}
		})))
}

// given the id of a recipe, retrieve its ingredients.
async function getIngredients(recipeId) {
	return await Promise.all((await notion.pages.retrieve({ page_id: recipeId }))
		.properties.Ingredienti.relation
		.map(async relation =>
			await notion.pages.retrieve({ page_id: relation.id }).then(async (result) => {
				return {
					ingredientName: result.properties.Name.title[0].plain_text,
					size: result.properties.Size.number
				}
			})))
}

// filter object for keys.
function reduceObject(object, allowedFields) {
	return Object.keys(object).reduce(function (newObj, key) {
		if (allowedFields.indexOf(key) !== -1) {
			newObj[key] = object[key];
		}
		return newObj;
	}, {});
}

build().then()
