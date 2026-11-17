/**
 * The people whose 3D models this site is built with. Each model is used
 * under Creative Commons Attribution 4.0, which asks for the title, the
 * author, a link to the source and a note of what was changed.
 */

export interface ModelCredit {
  title: string
  author: string
  /** The model's page on Sketchfab. */
  url: string
}

const sketchfab = (uid: string): string => `https://sketchfab.com/3d-models/${uid}`

export const CREDIT_LICENCE = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' } as const

export const CREDIT_GROUPS: readonly { heading: string; models: readonly ModelCredit[] }[] = [
  {
    heading: 'At this coffee bar',
    models: [
      { title: 'Commercial Coffee Machine', author: 'mreslan', url: sketchfab('bab05bc7805d4b0dbc2cdcbb48441956') },
      { title: 'Canarian Cafe - Coffee Grinder', author: 'lanzaboy', url: sketchfab('78d7e61da65c4b368074c978e742bdfc') },
      { title: 'Cup of Cappuccino', author: 'mazia', url: sketchfab('2beccb20ab744cabaeaddb36487f5cd7') },
      { title: 'Cup of Coffee', author: 'senorp3dro', url: sketchfab('f82264218618431d81b8a280076a786e') },
      { title: 'Milk Pitcher', author: 'PixiArch', url: sketchfab('82df114bcb8a4238a0c2e0bd381f2e50') },
    ],
  },
  {
    heading: 'In our reception plans',
    models: [
      { title: 'Tiffany Confort', author: 'misterwils', url: sketchfab('74260cb20c3546a09d2a1a3dc50498e2') },
      { title: 'Random Round Table ( Updated )', author: 'Rofnay', url: sketchfab('ae6df5aefa564a91a2ed5d406d5601bb') },
      { title: 'Tablecloth Lowpoly', author: 'grafikzeug', url: sketchfab('728d645702484493924e368b11dbc914') },
      { title: 'Place Setting Set', author: 'jswing_1', url: sketchfab('0a3dc72fb1bb41439005cac4a3ebb765') },
      { title: 'Wine Glass', author: 'Gamedirection', url: sketchfab('480cfc5b09ce4a1bb6b262e3686077c7') },
      { title: 'Magnolia in a vase', author: 'vav206', url: sketchfab('647a28ca37a84e0bbc312d0b8044452d') },
      { title: 'Medieval Chandelier', author: 'Kevin.Popescu', url: sketchfab('dd8b8bd637b5420badb323d5ec82a948') },
      { title: 'AC - Air Conditioner', author: 'auspicious', url: sketchfab('7d6b5831b43546c0ac82b878a78f8434') },
      { title: 'Outdoor wall lamp', author: 'GiantMidget', url: sketchfab('ce104953c4d145c4990ac75b4fc2422b') },
    ],
  },
]

/** What was done to the models, as the licence asks to be stated. */
export const CREDIT_CHANGES = 'Each model was simplified and resized for the web. Some were recoloured, and a few had parts removed.'

/** Not required to be credited (public domain), but thanked all the same. */
export const CREDIT_THANKS = 'Plants, trees, surfaces and sky from Poly Haven (CC0).'
