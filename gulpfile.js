const gulp = require('gulp');
const ts = require('gulp-typescript');
const sourcemaps = require('gulp-sourcemaps');
const fsn = require('fs-nextra');
const merge = require('merge2');
const webpack = require('webpack');
const webpackConfig = require('./webpack.config');
const project = ts.createProject('tsconfig.json');

async function clearBuild() {
  await Promise.all([
    fsn.emptydir('./dist'),
    fsn.emptyDir('./typings'),
  ]);
}

function buildBundle(cb) {
  webpack(webpackConfig, (err, stats) => {
    if (err) {
      console.error(err);
      return cb(err);
    }

    const info = stats.toJson();
    if (stats.hasErrors()) {
      console.error(info.errors);
      cb(info.errors);
    } else if (stats.hasWarnings()) {
      console.warn(info.warnings);
      cb(null, stats);
    } else {
      console.log(stats.toString({ colors: true }));
      cb(null, stats);
    }
  });
}

function buildProject() {
  const result = project.src()
    .pipe(sourcemaps.init())
    .pipe(project());

  return merge(
    result.dts.pipe(gulp.dest('typings')),
    result.js.pipe(sourcemaps.write('.', { sourceRoot: '../src' })).pipe(gulp.dest('dist')),
  );
}

exports.bundle = buildBundle;
exports.build = gulp.series(clearBuild, buildProject);
exports.default = gulp.series(clearBuild, gulp.parallel(buildProject, buildBundle));
