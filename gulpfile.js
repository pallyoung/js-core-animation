var gulp = require('gulp');
var rename = require('gulp-rename');
var uglify = require('gulp-uglify');

gulp.task('release',function(){
    gulp.src('./src/index.js')
    .pipe(rename('js-core-animation.js'))
    .pipe(gulp.dest('./dist'));
    gulp.src('./src/index.js')
    .pipe(rename('js-core-animation-min.js'))
    .pipe(uglify())
    .pipe(gulp.dest('./dist'))
})