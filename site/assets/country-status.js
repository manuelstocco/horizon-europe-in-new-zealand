(() => {
  /*
   * Horizon Europe country-status reference used by the Story map.
   * Update the arrays and metadata below when the programme status changes.
   * Associated status takes precedence over low- and middle-income eligibility.
   */
  const source = {
    eligibility: 'https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/horizon/wp-call/2026-2027/wp-15-general-annexes_horizon-2026-2027_en.pdf',
    association: 'https://research-and-innovation.ec.europa.eu/strategy/strategy-research-and-innovation/europe-world/international-cooperation/association-horizon-europe_en',
    outermostRegions: 'https://oceans-and-fisheries.ec.europa.eu/coastal-communities/europes-outermost-regions_en'
  };

  const eu27 = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
  const associated = ['AL','AM','BA','CA','EG','FO','GE','IS','IL','KR','XK','MD','ME','NZ','MK','NO','RS','CH','TR','TN','UA','GB'];
  const lowMiddleIncome = ['AF','DZ','AO','AR','AZ','BD','BY','BZ','BJ','BT','BO','BW','BF','BI','CV','KH','CM','CF','TD','CO','KM','CD','CG','CR','CI','CU','DJ','DM','DO','EC','EG','SV','GQ','ER','SZ','ET','FJ','GA','GM','GH','GD','GT','GN','GW','GY','HT','HN','ID','IR','IQ','JM','JO','KZ','KE','KI','KP','KG','LA','LB','LS','LR','LY','MG','MW','MY','MV','ML','MH','MR','MU','FM','MN','MA','MZ','MM','NA','NP','NI','NE','NG','NU','PK','PW','PS','PG','PY','PE','PH','RW','WS','ST','SN','SL','SB','SO','ZA','SS','LK','LC','VC','SD','SR','SY','TJ','TZ','TH','TL','TG','TO','TM','TV','UG','UZ','VU','VE','VN','YE','ZM','ZW'];

  const outermostRegions = [
    { code:'GF', name:'French Guiana', parentCode:'FR', parent:'France', lon:-53.1258, lat:3.9339 },
    { code:'GP', name:'Guadeloupe', parentCode:'FR', parent:'France', lon:-61.5510, lat:16.2650 },
    { code:'MQ', name:'Martinique', parentCode:'FR', parent:'France', lon:-61.0242, lat:14.6415 },
    { code:'MF', name:'Saint-Martin', parentCode:'FR', parent:'France', lon:-63.0501, lat:18.0708 },
    { code:'YT', name:'Mayotte', parentCode:'FR', parent:'France', lon:45.1662, lat:-12.8275 },
    { code:'RE', name:'Réunion', parentCode:'FR', parent:'France', lon:55.5364, lat:-21.1151 },
    { code:'PT-AZO', name:'Azores', parentCode:'PT', parent:'Portugal', lon:-25.6756, lat:37.7412 },
    { code:'PT-MAD', name:'Madeira', parentCode:'PT', parent:'Portugal', lon:-16.9595, lat:32.7607 },
    { code:'ES-CAN', name:'Canary Islands', parentCode:'ES', parent:'Spain', lon:-15.5000, lat:28.3000 }
  ];

  const overseasCountriesTerritories = [
    { code:'AW', name:'Aruba', parentCode:'NL', parent:'Netherlands', lon:-69.9683, lat:12.5211 },
    { code:'BQ-BO', name:'Bonaire', parentCode:'NL', parent:'Netherlands', lon:-68.2624, lat:12.1784 },
    { code:'CW', name:'Curaçao', parentCode:'NL', parent:'Netherlands', lon:-68.9900, lat:12.1696 },
    { code:'PF', name:'French Polynesia', parentCode:'FR', parent:'France', lon:-149.4068, lat:-17.6797 },
    { code:'TF', name:'French Southern and Antarctic Territories', parentCode:'FR', parent:'France', lon:69.3486, lat:-49.2804, mapCode:'TF' },
    { code:'GL', name:'Greenland', parentCode:'DK', parent:'Denmark', lon:-42.6043, lat:71.7069, mapCode:'GL' },
    { code:'NC', name:'New Caledonia', parentCode:'FR', parent:'France', lon:165.6180, lat:-20.9043, mapCode:'NC' },
    { code:'BQ-SA', name:'Saba', parentCode:'NL', parent:'Netherlands', lon:-63.2327, lat:17.6355 },
    { code:'BL', name:'Saint Barthélemy', parentCode:'FR', parent:'France', lon:-62.8333, lat:17.9000 },
    { code:'BQ-SE', name:'Sint Eustatius', parentCode:'NL', parent:'Netherlands', lon:-62.9770, lat:17.4890 },
    { code:'SX', name:'Sint Maarten', parentCode:'NL', parent:'Netherlands', lon:-63.0500, lat:18.0420 },
    { code:'PM', name:'Saint Pierre and Miquelon', parentCode:'FR', parent:'France', lon:-56.2711, lat:46.9419 },
    { code:'WF', name:'Wallis and Futuna Islands', parentCode:'FR', parent:'France', lon:-177.1561, lat:-13.7688 }
  ];

  const smallCountryMarkers = [
    { code:'MT', name:'Malta', lon:14.3754, lat:35.9375, status:'eu' },
    { code:'FO', name:'Faroe Islands', lon:-6.9118, lat:61.8926, status:'associated' }
  ];

  /* Reference points keep small Pacific island countries visible at closer zoom levels. */
  const pacificIslandCountries = [
    { code:'CK', name:'Cook Islands', lon:-159.7789, lat:-21.2367 },
    { code:'FJ', name:'Fiji', lon:178.0650, lat:-17.7134 },
    { code:'KI', name:'Kiribati', lon:-157.3630, lat:1.8709 },
    { code:'MH', name:'Marshall Islands', lon:171.1845, lat:7.1315 },
    { code:'FM', name:'Micronesia', lon:158.1499, lat:6.8874 },
    { code:'NR', name:'Nauru', lon:166.9315, lat:-0.5228 },
    { code:'NU', name:'Niue', lon:-169.8672, lat:-19.0544 },
    { code:'PW', name:'Palau', lon:134.5825, lat:7.5150 },
    { code:'PG', name:'Papua New Guinea', lon:147.1803, lat:-9.4438 },
    { code:'WS', name:'Samoa', lon:-171.7514, lat:-13.8507 },
    { code:'SB', name:'Solomon Islands', lon:159.9729, lat:-9.4456 },
    { code:'TO', name:'Tonga', lon:-175.1982, lat:-21.1394 },
    { code:'TV', name:'Tuvalu', lon:179.1962, lat:-8.5211 },
    { code:'VU', name:'Vanuatu', lon:168.3273, lat:-17.7333 }
  ];

  window.HE_COUNTRY_STATUS = {
    metadata: {
      checked:'31 August 2026',
      programmePeriod:'Horizon Europe 2026–2027 work programme',
      precedence:['new-zealand','eu','associated','oct','lmic','other'],
      source
    },
    eu27,
    associated,
    lowMiddleIncome,
    outermostRegions,
    overseasCountriesTerritories,
    smallCountryMarkers,
    pacificIslandCountries
  };
})();
