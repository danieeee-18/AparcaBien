import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import indexRouter from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'secreto_aparcabien',
  resave: false,
  saveUninitialized: false
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use('/', indexRouter);

app.listen(PORT, () => {
  console.log(`Servidor AparcaBien en http://localhost:${PORT}`);
});
