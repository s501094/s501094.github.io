const express = require('express');
const path = require('path');
const app = express();
const portNumber = 3535;

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || portNumber;
app.listen(PORT, () => {
	console.log('Server is running on port ' + PORT);
});


