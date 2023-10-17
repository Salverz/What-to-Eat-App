document.querySelector("#addIngredient").addEventListener("click", addIngredient);
document.querySelector("#pantry").addEventListener("click", togglePantry);

// ON INIT
// Set the checked value based on the current session value of pantry
initPantry();
async function initPantry() {
    const pantry = await fetch("/pantry");
    const json = await pantry.json()
    document.querySelector("#pantry").checked = json.checked;
}

// Event listener for delete ingredient buttons
const buttons = document.querySelectorAll(".removeIngredient");
buttons.forEach(button => {
    button.addEventListener('click', removeIngredient);
});

// Add ingredient to the database and then add it to the page
async function addIngredient() {
    const ingredient = document.querySelector("#ingredient").value;
    const response = await fetch('/ingredient/add',
    {
        method:"POST",
        body: JSON.stringify({"ingredient":ingredient}),
        headers: {
            "Content-Type":"application/json"
        }
    });
    const json = await response.json();
    console.log(json);

    // Item successfully added to database
    if (json.success) {
        document.querySelector("#ingredients").innerHTML +=
        `<div id="${ingredient}">
        <button class="removeIngredient" id="${ingredient}Del">Remove</button>
            ${ingredient}
        </div>`;

        // Add event listners to remove button
        const buttons = document.querySelectorAll(".removeIngredient");
        buttons.forEach(button => {
            button.addEventListener('click', removeIngredient);
        });
        document.querySelector("#ingredient").value = "";
    }
}

// Remove ingredient from the database and then remove it from the page
async function removeIngredient(event) {
    const ingredient = event.target.parentElement.getAttribute("id");
    const response = await fetch('/ingredient/remove',
    {
        method:"POST",
        body: JSON.stringify({"ingredient":ingredient}),
        headers: {
            "Content-Type":"application/json"
        }
    });
    const json = await response.json();

    // Item successfully deleted from database
    if (json.success) {
        const ingredientElement = document.querySelector(`#${ingredient}`);
        ingredientElement.remove();
    }
}

// Toggle ignore pantry items setting
async function togglePantry() {
    const pantryChecked = document.querySelector("#pantry").checked;
    console.log(pantryChecked);

    fetch('/pantry',
    {
        method:"POST",
        body: JSON.stringify({"pantry":pantryChecked}),
        headers: {
            "Content-Type":"application/json"
        }
    });
    
}