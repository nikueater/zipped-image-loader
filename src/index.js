import JSZip from 'jszip'

//-- utilities
// 一つでもパターンにマッチするか
const matches = (text, patterns) =>
  patterns
    .map( (p) => text.match(p) )
    .some( (e) => e !== null )

// Blobをファイルオブジェクトに変換
const blob2file = (blob, name, modified) => {
  blob.lastModifiedDate = modified
  blob.name = name
  return blob
}

// 恒等射
const id = a => a

/* ImageManager
 * ------------------------------------
 * FUNCTIONS
 * setDropZone = dropZone -> ()
 *  ドロップする領域を指定
 *  dropZone: D&D対象のDOM
 *
 * setInputForm = input -> ()
 *  ファイル指定フォームを指定
 *  input: input[type=file]
 * 
 * loadAsDataUrl = fileObject -> callback -> ()
 *  fileObjectをDataUrlとしてロードしコールバックに渡す
 *  fileObject: File
 *  callback: DataURL -> ()
 *
 * setDropZone = dropZone
 * ------------------------------------
 * PROPERTIES
 * onLoad = (File) -> ()
 *  指定されたファイルのうち画像がロードされたタイミングで呼び出される
 *
 * onInvalid = (File) -> ()
 *  指定されたファイルのうち不正なファイルがあると呼び出される
 */
export default class ImageManager {
  setDropZone (dropzone) {
    dropzone.addEventListener('dragover', e => this.onDragOver(e))
    dropzone.addEventListener('dragleave', e => this.onDragLeave(e))
    dropzone.addEventListener('drop', e => this.onDrop(e))
  }

  setInputForm (input) {
    input.addEventListener('change', e => this.onInputChange(e))
  }

  onDragOver (e) {
    e.preventDefault()
  }

  onDragLeave (e) {
    e.preventDefault()
  }

  onDrop (e) {
    e.stopPropagation()
    e.preventDefault()
    const files = 
        Array.from(e.dataTransfer.items)
        .map( x => x.getAsFile() )
    this._getImages(files, e.dataTransfer.files)
  }

  onInputChange (e) {
    e.preventDefault()
    const files = 
        Array.from(e.srcElement.files)
    this._getImages(files)
  }

  _getImages (files, source) {
    this.onLoad = this.onLoad || id
    this.onInvalid = this.onInvalid || id
    const acceptable = {
      image: /^image\/(jpeg|png)$/,
      archive: /^application\/zip$/
    }
    const sizeLimit = {
      image: 3 * 1024 * 1024,
      archive: 10 * 1024 * 1024
    }

    // 画像ファイル
    const images =
      files
        .filter( f => f.type.match( acceptable.image ))
        .filter( f => f.size < sizeLimit.image )

    images.forEach( f => this.onLoad(f, source) )

    // zipファイル
    const archives =
      files
        .filter( f => f.type.match( acceptable.archive ))
        .filter( f => f.size < sizeLimit.archive )

    archives
      .map( f => new ZipLoader(f) )
      .forEach( zip => zip.loadImages(sizeLimit.image, this.onLoad, this.onInvalid))


    // zipでもimageでもないファイルがあればエラーを吐く
    files
      .filter(f => !~images.indexOf(f))
      .filter(f => !~archives.indexOf(f))
      .forEach(f => this.onInvalid(f))
  }

  loadAsDataUrl (image, callback = id) {
    const fr = new FileReader()
    fr.onload = callback
    fr.readAsDataURL(image)
  }
}

class ZipLoader {
  constructor (zipFile) {
    this.zip = zipFile
    this.jszip = new JSZip()
  }

  loadImages (sizeLimit, onLoad = id, onInvalid = id) {
    this.jszip
      .loadAsync( this.zip )
      .then( zip => {
        // アーカイブ中の有効なファイル名一覧を取得
        const validNames =
          this._filterFileNames(Object.keys(zip.files))
        // 有効なファイルオブジェクトを抽出
        const files =
          validNames
            .map( x => zip.files[x] )
        // ファイルオブジェクトをロードしてコールバックに渡す
        files.forEach( file => {
          file.async("blob").then( b => {
            const image = blob2file(b, file.name, file.date)
            const callback =  
                (image.size < sizeLimit) ? onLoad : onInvalid
            callback(image)
          })
        })
    })
  }

  // List String -> List String
  // ファイル名一覧から有効な画像ファイルのファイル名を返す
  _filterFileNames (srcFiles) {
    const blackList =
      [ /^__MACOSX\/.*$/
      , /^.*\.DS_Store$/
      ]
    const whiteList =
      [ /.*\.jpg$/
      , /\.jpeg$/
      , /\.png$/
      ]
    return srcFiles
      .filter( x => !matches( x, blackList ) )
      .filter( x => matches( x.toLowerCase(), whiteList ) )
  }
}

window.ImageManager = ImageManager
