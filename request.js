const { Client } = require('@notionhq/client');
const { error } = require('console');
const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function build() {
	try {
		// retrieve menu list.
		const databaseId = 'dba2b39a6cb74962a01c998c9c78e229';
		results = {}
		results.menus = await notion.databases.query({ database_id: databaseId, });
		// list first menu blocks.
		results.first_menu_blocks = await notion.blocks.children.list({ block_id: results.menus.results[0].id });
		// read the day-meal-recipes database.
		results.first_menu_db = await notion.databases.query({ database_id: results.first_menu_blocks.results[0].id });
		// build day-pranzo/cena map.
		results['day-pranzo/cena'] = await Promise.all(reduceObject(results.first_menu_db, ['results'])
			.results.map(result => reduceObject(result, 'properties'))
			.map(async day => {
				return {
					day: day.properties.Name.title[0].plain_text,
					pranzo: await getCourses(day, 'Pranzo')
				}
			}))

	} catch (e) {
		console.log("Failed", e)
	} finally {
		console.log(JSON.stringify(results, null, 2))
	}
}

// given the name of a meal, retrieve its courses.
async function getCourses(day, meal) {
	return await Promise.all(day.properties[meal].relation.map(async relation =>
		await notion.blocks.retrieve({ block_id: relation.id }).then( async (result) => {
			return {
				recipeName: result.child_page.title,
				recipeId: await getIngredients(relation.id)
			}
		})))
}

// given the id of a recipe, retrieve its ingredients.
async function getIngredients(recipeId) {
	return await notion.blocks.retrieve({ block_id: recipeId })
	// .then((result) => {
	// 		return {
	// 			recipeName: result.child_page.title,
	// 			recipeId: relation.id
	// 		}
	// 	})
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

build().then(console.log(''))


