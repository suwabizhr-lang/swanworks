(function (root, factory) {
  const products = factory();
  if (typeof module === 'object' && module.exports) module.exports = products;
  root.SWANWORKS_PRODUCTS = products;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  return [
    {
      id: 'pasyatto',
      name: 'パシャっと出品',
      tagline: 'スマホで商品をぐるっと撮った動画1本から、背景を整えた出品用の画像（正面・接写・パーツなど）を自動で一式つくるWebサービス',
      audience: 'フリマ・オークション出品者、せどり、リサイクル店、ネットショップの商品撮影担当',
      lpUrl: 'https://pasyatto-for-sale.com/lp.html',
      logo: 'lp-assets/pasha-logo.png',
      status: '販売中'
    },
    {
      id: 'quima',
      name: 'クイマ',
      tagline: 'お店の情報とキャンペーンを入れるだけで、SNS集客記事・PR動画・申込/予約フォーム（QR）をAIが一式つくる集客の専用機',
      audience: '飲食店・サロン／整体・教室・小売／EC・士業・フリーランスなど、小さなお店や一人事業',
      lpUrl: 'https://quickmarketing-pro.com/lp.html',
      logo: 'lp-assets/quima-h-dark.svg',
      status: '販売中'
    },
    {
      id: 'soramoto',
      name: 'ソラモト',
      tagline: 'テーマを選ぶだけで、AIが調べ・構成し・書き上げる記事づくりの専用機。AIが下書きの大部分をつくり、最後は本人が確認・加筆する設計',
      audience: '記事を継続して書きたい個人・小規模事業者',
      lpUrl: 'https://soramoto.jp/lp.html',
      logo: 'lp-assets/soramoto-dark.svg',
      status: '販売中'
    }
  ];
});
