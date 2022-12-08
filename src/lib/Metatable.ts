export class MetaTable {
  constructor(
    public raw: any = { },
    public proxy: any = { },
  ) { }

  get(key: string, raw?: boolean) {
    if(raw){
      return this.raw[key]
    } else {
      return this.raw[key] ?? this.proxy[key]
    }
  }
}
