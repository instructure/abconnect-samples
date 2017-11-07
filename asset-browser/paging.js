var gPaging = {
  pageSize: 25,
  offset: 0,
  count: 0
};
//
// hidePaging - hide the paging sections (avoid awkward flashing, etc.)
//
function hidePaging(){
  $('.resultsFooter').css('visibility', 'hidden');
  $('.resultsHeader').css('visibility', 'hidden');
}
//
// showPaging - show the paging sections and show/hide the elements based on the particular data state
//
function showPaging(){
  //
  // show the header and footer in general
  //
  $('.resultsFooter').css('visibility', 'visible');
  $('.resultsHeader').css('visibility', 'visible');
  //
  // show first/previous as long as we aren't on the first page
  //
  var page = currentPage();
  var maxPage = pageCount();
  if (page > 1) {
    $('.firstPage').css('visibility', 'visible');
    $('.prevPage').css('visibility', 'visible');
  } else {
    $('.firstPage').css('visibility', 'hidden');
    $('.prevPage').css('visibility', 'hidden');
  }
  //
  // show next/last as long as we aren't on the last page
  //
  if (page < maxPage) {
    $('.lastPage').css('visibility', 'visible');
    $('.nextPage').css('visibility', 'visible');
  } else {
    $('.lastPage').css('visibility', 'hidden');
    $('.nextPage').css('visibility', 'hidden');
  }
  //
  // set the paging footer
  //
  if (maxPage > 1) {
    $('.position').text('page ' + page + ' of ' + maxPage);
    $('.position').css('visibility', 'visible');
  } else {
    $('.position').css('visibility', 'hidden');
  }
}
//
// updatePaging - retrieve the current page information
//  data - the API response
//
function updatePaging(data){
  gPaging.offset = data.meta.offset;
  gPaging.count = data.meta.count;
  gPaging.pageSize = data.meta.limit; // not strictly necessary
}
//
// currentPage - retrieve the current page number
//
function currentPage(){
  return Math.floor(gPaging.offset / gPaging.pageSize) + 1;
}
//
// pageCount - retrieve the total number of pages
//
function pageCount(){
  return Math.ceil(gPaging.count / gPaging.pageSize);
}
//
// setPageSize - set the paging
//  newSize - the new page size
//
function setPageSize(newSize){
  var oldSize = gPaging.pageSize;
  
  if (oldSize === newSize) return; // nothing actually changed, get out of here
  //
  // if we aren't on the first page, we need to adjust all of the offsets so we don't end up mid page on something
  //
  if (currentPage() > 1) {
    gPaging.offset = Math.floor(gPaging.offset / newSize) * newSize;
  }
  
  gPaging.pageSize = newSize;
  
  var oldClassName = '.page' + oldSize;
  var newClassName = '.page' + newSize;
  $(oldClassName).css('font-size', '100%'); // make the old number small again
  $(oldClassName + ':hover').css('text-decoration', 'underline');
  $(newClassName).css('font-size', '150%'); // make the new page size bigger so it stands out
  $(newClassName + ':hover').css('text-decoration', 'none');
  
  loadAssets(); // if it actually changed, then refresh the page
}
//
// pageFirst - go back to the first page
//
function pageFirst(){
  gPaging.offset = 0;
  
  loadAssets();
}
//
// pagePrev - go back to the previous page
//
function pagePrev(){
  gPaging.offset -= gPaging.pageSize;
  
  loadAssets();
}
//
// pageNext - go forward to the next page
//
function pageNext(){
  gPaging.offset += gPaging.pageSize;
  
  loadAssets();
}
//
// pageLast - go to the last page
//
function pageLast(){
  gPaging.offset = (pageCount() - 1) * gPaging.pageSize; // calculate the offset of the final page
  
  loadAssets();
}
