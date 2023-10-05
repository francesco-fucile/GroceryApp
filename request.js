const { Client } = require('@notionhq/client');
const { error } = require('console');
const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function build() {
	try {
		// retrieve menu list
		const databaseId = 'dba2b39a6cb74962a01c998c9c78e229';
		results = {}
		results.menus = await notion.databases.query({ database_id: databaseId, });
		// list first menu blocks
		results.first_menu_blocks = await notion.blocks.children.list({ block_id: results.menus.results[0].id });
		// read the menu database
		results.first_menu_db = await notion.databases.query({ database_id: results.first_menu_blocks.results[0].id });
		// extract meals for the first day dinner
		results.first_day_dinner_first_meal = await notion.blocks.retrieve({ block_id: results.first_menu_db.results[0].properties.Cena.relation[0].id })
		// map meals for the day meals
		results.meals_map = await Promise.all(results.first_menu_db.results.map(async day => day.properties.Name.title[0]?.plain_text)
			.map(async day => {
				return {
					[await day]: {
						Cena:
							await Promise.all(results.first_menu_db.results[0].properties.Cena.relation.map(
								async relation => await notion.blocks.retrieve({ block_id: relation.id }).then((result) => result.child_page.title)
							)),
						Pranzo: await Promise.all(results.first_menu_db.results[0].properties.Pranzo.relation.map(
							async relation => await notion.blocks.retrieve({ block_id: relation.id }).then((result) => result.child_page.title)
						)),
					}
				}
				}))
	} catch (e) {
		console.log("Failed", e)
	} finally {
		console.log(JSON.stringify(results, null, 2))
	}
}

build().then(console.log(''))


