import React, { useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';

// ── Silhouette PNG assets ─────────────────────────────────────────────────────
// All PNGs: white silhouette on transparent background, 800×200px recommended
// Place files in: assets/silhouettes/
//
// Vehicle-specific: named by vehicle UUID e.g. 2a0f9ced-....png
// Category fallback: named by silhouette_category string from vehicles table
// Final fallback: generic.png

const CATEGORY_SILHOUETTES: Record<string, any> = {
  sports_racer:            require('../../assets/silhouettes/_generic-sports_racer.png'),
  formula:                 require('../../assets/silhouettes/_generic-formula.png'),
  modern_coupe:            require('../../assets/silhouettes/_generic-modern-sports.png'),
  roadster:                require('../../assets/silhouettes/_generic-open-top-road.png'),
  muscle:                  require('../../assets/silhouettes/_generic-1960s-america.png'),
  vintage_british:         require('../../assets/silhouettes/_generic-1960s-british.png'),
  vintage_european:        require('../../assets/silhouettes/_generic-1960s-european.png'),
  vintage_german_japanese: require('../../assets/silhouettes/_generic-1960s-japanese.png'),
  generic:                 require('../../assets/silhouettes/_generic.png'),
};

// Vehicle-specific overrides.
// Uncomment each line as you add the corresponding PNG to assets/silhouettes/.
const VEHICLE_SILHOUETTES: Record<string, any> = {
  // ── formula ──────────────────────────────────────────
  // 1959–1963 Elva Formula Junior Ford 105E
  // '12c50ca4-f549-4355-b086-c4437a7f1f1a': require('../../assets/silhouettes/12c50ca4-f549-4355-b086-c4437a7f1f1a.png'),
  // 1960–1961 Lotus 18 Formula Junior
  // '27a6abbe-39a2-4e6e-836e-6bfd7ef20a31': require('../../assets/silhouettes/27a6abbe-39a2-4e6e-836e-6bfd7ef20a31.png'),
  // 1961–1962 Lotus 20 Formula Junior
  // 'b8c73d49-ac15-4bce-8235-4b045aedf843': require('../../assets/silhouettes/b8c73d49-ac15-4bce-8235-4b045aedf843.png'),
  // 1962–1963 Lotus 22 Cosworth Mk.IV 1100
  // '68955cd8-1c64-4568-a26f-a97a3db35a3e': require('../../assets/silhouettes/68955cd8-1c64-4568-a26f-a97a3db35a3e.png'),
  // 1963–1963 Lotus 27 Formula Junior
  // '76a9fa7c-f924-47bb-bcfe-803e97439b13': require('../../assets/silhouettes/76a9fa7c-f924-47bb-bcfe-803e97439b13.png'),

  // ── modern_coupe ──────────────────────────────────────────
  // 1997–2001 Acura Integra Type R
  // '8194607b-5e34-4552-b14c-9d22a2a38566': require('../../assets/silhouettes/8194607b-5e34-4552-b14c-9d22a2a38566.png'),
  // 2008–2013 BMW 3 Series M3
  // '2dd9265e-7af8-41e5-81cc-958d556595b1': require('../../assets/silhouettes/2dd9265e-7af8-41e5-81cc-958d556595b1.png'),
  // 2011–2012 BMW 1 Series 1M Coupe
  // 'b77cdc5a-dce1-47d4-9a49-9cb0ff2aa930': require('../../assets/silhouettes/b77cdc5a-dce1-47d4-9a49-9cb0ff2aa930.png'),
  // 2015–2020 BMW 3 Series M3
  // 'a505c203-c8cb-4bfe-927f-1131c46e06b9': require('../../assets/silhouettes/a505c203-c8cb-4bfe-927f-1131c46e06b9.png'),
  // 2021–2025 BMW 3 Series M3
  // '05f04981-d794-4dbf-a1af-cc1fb485dd81': require('../../assets/silhouettes/05f04981-d794-4dbf-a1af-cc1fb485dd81.png'),
  // 2023–2025 BMW 2 Series M2
  // 'ad1b5510-e635-4c15-ac73-427b7484bc46': require('../../assets/silhouettes/ad1b5510-e635-4c15-ac73-427b7484bc46.png'),
  // 2024–2025 BMW 4 Series M4 CS
  // '10ce3f1d-ce88-481d-9fb9-6b3b5fcf065c': require('../../assets/silhouettes/10ce3f1d-ce88-481d-9fb9-6b3b5fcf065c.png'),
  // 2014–2019 Chevrolet Corvette Stingray
   'af5210e2-3cad-4df9-8725-ccd9fde46d94': require('../../assets/silhouettes/chevrolet-corvette-c6.png'),
  // 2023–2025 Chevrolet Corvette Z06
   '77360346-fec9-468f-b793-5fcca926d1ed': require('../../assets/silhouettes/chevrolet-corvette-c8.png'),
  // 2017–2021 Honda Civic Type R
   '436eae06-ecd8-4287-ab22-64e29f46d12f': require('../../assets/silhouettes/honda-civic-type-r.png'),
  // 2023–2025 Honda Civic Type R
   '834689be-90b3-491e-84f7-7706bf904fc0': require('../../assets/silhouettes/honda-civic-type-r.png'),
  // 2003–2007 Mitsubishi Lancer Evolution MR
   '0be9c33f-3700-4008-9afc-67968000e736': require('../../assets/silhouettes/mitsubishi-lancer.png'),
  // 2003–2009 Nissan 350Z Base
  // '37f7275b-d47a-4cc2-9988-f1235b66cd42': require('../../assets/silhouettes/37f7275b-d47a-4cc2-9988-f1235b66cd42.png'),
  // 2009–2024 Nissan GT-R Base
   '1156be54-619d-44d2-b056-51631789956f': require('../../assets/silhouettes/nissan-gt-r.png'),
  // 2009–2021 Nissan 370Z Base
  // 'aa549dc7-779b-47b5-9ded-2e92fdaa7fee': require('../../assets/silhouettes/aa549dc7-779b-47b5-9ded-2e92fdaa7fee.png'),
  // 1999–2004 Porsche 911 GT3
   '1bb283ab-2e7f-4266-beb4-27b63bbffc62': require('../../assets/silhouettes/2000s-porsche-911.png'),
  // 2004–2009 Porsche 911 GT3
   'c9a32a89-c086-4ece-a329-c9a96487915a': require('../../assets/silhouettes/2000s-porsche-911.png'),
  // 2014–2019 Porsche 911 GT3
   '2a0f9ced-bf2e-4ee1-bd5d-69492d05b6a4': require('../../assets/silhouettes/2010s-porsche-911.png'),
  // 2016–2019 Porsche 911 GT3 RS
   'c852ae75-40bb-4600-a4da-22340f95337d': require('../../assets/silhouettes/2010s-porsche-911.png'),
  // 2023–2024 Porsche 911 GT3
   '12fbab5b-3b52-471c-975e-cadcd1ecd47e': require('../../assets/silhouettes/2010s-porsche-911.png'),
  // 2023–2024 Porsche 911 GT3 RS
   '1404ae7c-33a9-4013-8817-4e0cf694baa8': require('../../assets/silhouettes/2010s-porsche-911.png'),
  // 2013–2021 Subaru BRZ Base
   'c0a69aa2-0f40-40bb-8d50-87340165d3e4': require('../../assets/silhouettes/subaru-br-z.png'),
  // 2017–2021 Toyota 86 Base
   '592497b2-e4c2-48f5-98f8-b87aa7ffa7fc': require('../../assets/silhouettes/subaru-br-z.png'),
  // 2020–2025 Toyota Supra Base
   '50d64839-88a8-40ea-bc58-9f9ef3093a2b': require('../../assets/silhouettes/toyota-supra-new.png'),

  // ── muscle ──────────────────────────────────────────
  // 1965–1966 Shelby Mustang GT350 Shelby
    '6bfb762c-2bee-4a24-8b3a-ac7bc0eb119b': require('../../assets/silhouettes/1968-mustang-350.png'),

  // ── roadster ──────────────────────────────────────────
  // 2017–2022 Acura NSX Base
   '0edf5d44-7663-4db3-8edf-f95d4b52c3e5': require('../../assets/silhouettes/1990s-acura-nsx.png'),
  // 2006–2008 BMW Z4 M Coupe
  // '7c4c6991-eeec-44d9-823e-325f4fb217cd': require('../../assets/silhouettes/7c4c6991-eeec-44d9-823e-325f4fb217cd.png'),
  // 1999–2003 Honda S2000 Base
   '4f52aa5f-9ab7-4ad2-805f-57ba9140498d': require('../../assets/silhouettes/honda-s2000.png'),
  // 2004–2009 Honda S2000 Base
   '21cf6d4e-38e3-418b-9d50-633bc6125a7f': require('../../assets/silhouettes/honda-s2000.png'),
  // 1957–1960 Lotus Seven Series 1
  // '8bcd17d4-7ae4-477e-806c-e36b7a81def9': require('../../assets/silhouettes/8bcd17d4-7ae4-477e-806c-e36b7a81def9.png'),
  // 1962–1965 Lotus Elan S1/S2
  // '9b32616c-a55e-4c36-b936-630ee7b300df': require('../../assets/silhouettes/9b32616c-a55e-4c36-b936-630ee7b300df.png'),
  // 1965–1968 Lotus Elan S3
  // '6af80df5-4bec-42a7-b602-9181674c152c': require('../../assets/silhouettes/6af80df5-4bec-42a7-b602-9181674c152c.png'),
  // 1968–1973 Lotus Elan S4 / Sprint
  // '811dd077-ed83-4d08-bac3-766c70dada70': require('../../assets/silhouettes/811dd077-ed83-4d08-bac3-766c70dada70.png'),
  // 1970–1973 Lotus Seven Series 4
  // '7b68de6d-151a-49c9-abd1-dd55b2768b23': require('../../assets/silhouettes/7b68de6d-151a-49c9-abd1-dd55b2768b23.png'),
  // 1996–2000 Lotus Elise S1
   '327a6045-3ad3-4921-bdef-1fae634b3464': require('../../assets/silhouettes/lotus-elise (1).png'),
  // 2000–2002 Lotus Exige S1
   '11d8ad72-95f1-4a0d-a12b-0d9126742051': require('../../assets/silhouettes/lotus-exige.png'),
  // 2001–2004 Lotus Elise S2 K-series
   '4b7904bb-a8db-41ea-81e0-8e96317d2f4e': require('../../assets/silhouettes/lotus-elise (1).png'),
  // 2002–2004 Lotus Esprit V8 Final Edition
  // '8fe46298-447d-4f41-9d14-425a6522f86c': require('../../assets/silhouettes/8fe46298-447d-4f41-9d14-425a6522f86c.png'),
  // 2004–2006 Lotus Elise S2 111R
   '2f8105aa-e6b9-4b24-a2a2-282d24dbb301': require('../../assets/silhouettes/lotus-elise (1).png'),
  // 2004–2011 Lotus Exige S2
   'bb538005-5acf-4c37-8f38-2dbc5b8390f4': require('../../assets/silhouettes/lotus-exige.png'),
  // 2006–2011 Lotus Elise S2 SC/2ZZ
   '4eb925b8-71c5-4c06-8130-0a9406b1a917': require('../../assets/silhouettes/lotus-elise (1).png'),
  // 2006–2010 Lotus Europa S
  // '6fd2c61a-e576-4f5c-8373-d0b5429a0079': require('../../assets/silhouettes/6fd2c61a-e576-4f5c-8373-d0b5429a0079.png'),
  // 2007–2011 Lotus 2-Eleven Base
  // '4ac3d7be-1d49-49bf-9e7b-663ce17ff9bd': require('../../assets/silhouettes/4ac3d7be-1d49-49bf-9e7b-663ce17ff9bd.png'),
  // 2008–2011 Lotus Exige S2 S Supercharged
   '7ef5aeda-6a44-4baf-aa8d-16770aef4a88': require('../../assets/silhouettes/lotus-exige.png'),
  // 2009–2012 Lotus Evora NA
  // '358d7504-7ffc-4fe5-aeea-2944cfc66322': require('../../assets/silhouettes/358d7504-7ffc-4fe5-aeea-2944cfc66322.png'),
  // 2011–2021 Lotus Elise S3
   '00f611e8-6eb2-47a4-aac3-275ce902d7ba': require('../../assets/silhouettes/lotus-elise (1).png'),
  // 2011–2015 Lotus Evora S
  // '9113afc1-c94b-435d-974c-b1bbf111f3a9': require('../../assets/silhouettes/9113afc1-c94b-435d-974c-b1bbf111f3a9.png'),
  // 2015–2019 Lotus 3-Eleven Base
  // '00d25656-6212-433f-ab0c-2438041b28e6': require('../../assets/silhouettes/00d25656-6212-433f-ab0c-2438041b28e6.png'),
  // 2016–2021 Lotus Elise Cup 250
   'af0ebf88-787b-4730-bb67-a6299318052b': require('../../assets/silhouettes/lotus-elise (1).png'),
  // 2017–2021 Lotus Exige Cup 430
   'bf94e103-d2ba-43a5-8e94-5ad78f89429d': require('../../assets/silhouettes/lotus-exige.png'),
  // 2022–2025 Lotus Emira V6 Supercharged
   '0f1dd3ea-65f5-4b77-8e8f-b329b335ddad': require('../../assets/silhouettes/lotus-emira.png'),
  // 2022–2023 Lotus Emira First Edition
   '347f375e-29fd-4307-874f-4a428cf7e65b': require('../../assets/silhouettes/lotus-emira.png'),
  // 2022–2025 Lotus Emira i4
   '4f05c604-35e2-4349-b4ff-30def998ff4e': require('../../assets/silhouettes/lotus-emira.png'),
  // 1990–2005 Mazda Miata Base
   'ccaa2aec-cce8-4f5f-9597-22522894170a': require('../../assets/silhouettes/1994-mazda-miata-fastback.png'),
  // 2006–2015 Mazda Miata Base
  // '3314b031-bb59-42eb-8e32-316f5f9325d4': require('../../assets/silhouettes/3314b031-bb59-42eb-8e32-316f5f9325d4.png'),
  // 2016–2025 Mazda Miata Base
   '6d6be1a9-2f3b-4916-a7e7-4f957ff2bf40': require('../../assets/silhouettes/mazda-miata-nd.png'),
  // 1970–1976 Porsche 914 2.0
  // '15d8fc81-408a-484d-b29a-4bee28eabb8c': require('../../assets/silhouettes/15d8fc81-408a-484d-b29a-4bee28eabb8c.png'),
  // 1997–2004 Porsche Boxster S
   '3e44f7d8-8112-4bb5-98e2-26c482777f59': require('../../assets/silhouettes/porsche-boxster.png'),
  // 2006–2012 Porsche Cayman S
   '729c7c08-f041-4dc6-9659-0a2e96e97530': require('../../assets/silhouettes/porsche-caymen.png'),
  // 1991–1995 Toyota MR2 Turbo
  // 'b79b86e2-e5ab-448b-817c-c0198ba39e59': require('../../assets/silhouettes/b79b86e2-e5ab-448b-817c-c0198ba39e59.png'),

  // ── sports_racer ──────────────────────────────────────────
  // 1962–1967 AC Cobra 289 V8
   '877e9df6-9364-4520-b6ae-042a3a7128d0': require('../../assets/silhouettes/1960s-ac-cobra.png'),
  // 1955–1957 Elva Sports Racer Coventry Climax FWA
  // '0f96dd9d-a2d7-413a-853a-70aa22ab99ac': require('../../assets/silhouettes/0f96dd9d-a2d7-413a-853a-70aa22ab99ac.png'),
  // 1957–1958 Elva Sports Racer Coventry Climax FWA
  // 'af754105-8f97-4e44-8065-69a66bf3aa83': require('../../assets/silhouettes/af754105-8f97-4e44-8065-69a66bf3aa83.png'),
  // 1959–1960 Elva Sports Racer Coventry Climax FWA / Ford
  // '8c40ad36-049a-4e6a-98b1-8dbb9e23d20f': require('../../assets/silhouettes/8c40ad36-049a-4e6a-98b1-8dbb9e23d20f.png'),
  // 1960–1961 Elva Sports Racer Coventry Climax / Ford
  // '3e2e0a74-dc69-4dc1-a537-039ce49bca34': require('../../assets/silhouettes/3e2e0a74-dc69-4dc1-a537-039ce49bca34.png'),
  // 1961–1963 Elva Sports Racer Ford 105E / Coventry Climax
  // 'a4ee5154-dd9f-4db2-af8a-c3479ab68be4': require('../../assets/silhouettes/a4ee5154-dd9f-4db2-af8a-c3479ab68be4.png'),
  // 1962–1965 Elva Elva-Porsche Porsche 4-cam 1600 / 2000
  // '18a5eb80-7c42-4c23-ac56-80e303da5309': require('../../assets/silhouettes/18a5eb80-7c42-4c23-ac56-80e303da5309.png'),
  // 1964–1965 Elva McLaren-Elva M1A Oldsmobile 4.5L V8
  // '64b53ad9-b7df-43c8-839c-0497bee12fb2': require('../../assets/silhouettes/64b53ad9-b7df-43c8-839c-0497bee12fb2.png'),
  // 1965–1966 Elva McLaren-Elva M1B Chevrolet 5.0L V8
  // 'bce94c34-1867-40cf-ab05-9dac52d026fe': require('../../assets/silhouettes/bce94c34-1867-40cf-ab05-9dac52d026fe.png'),
  // 1966–1969 Elva Sports Racer Ford / BMW
  // '90ac053e-0f31-46cb-ac6d-790d06eb9211': require('../../assets/silhouettes/90ac053e-0f31-46cb-ac6d-790d06eb9211.png'),
  // 1964–1969 Ford GT40 MkI
  // '9c84aae7-55be-4896-bc4b-c710492500b8': require('../../assets/silhouettes/9c84aae7-55be-4896-bc4b-c710492500b8.png'),
  // 1957–1958 Lotus Eleven Series 2
  // 'aef97e42-dd88-4adb-a6f0-79096ffddd9c': require('../../assets/silhouettes/aef97e42-dd88-4adb-a6f0-79096ffddd9c.png'),
  // 1962–1963 Lotus 23 Sports Racer
  // '0c0a4d2b-1882-4ad3-96d2-bd27cabb2ee2': require('../../assets/silhouettes/0c0a4d2b-1882-4ad3-96d2-bd27cabb2ee2.png'),
  // 1963–1968 Lotus Elan 26R 26R
  // '6e876c96-4e86-49ed-b7ca-89fd7b4e13e7': require('../../assets/silhouettes/6e876c96-4e86-49ed-b7ca-89fd7b4e13e7.png'),

  // ── vintage_british ──────────────────────────────────────────
  // 1959–1967 Austin Healey 3000 MkIII
  // '12bbef20-43ae-4b89-9e35-04e35f9563aa': require('../../assets/silhouettes/12bbef20-43ae-4b89-9e35-04e35f9563aa.png'),
  // 1958–1961 Elva Courier BMC A-series
  // '7cb50162-9b4f-45a2-9790-4213c9d82378': require('../../assets/silhouettes/7cb50162-9b4f-45a2-9790-4213c9d82378.png'),
  // 1961–1962 Elva Courier Ford 105E
  // '6b4546dd-d21b-4631-9352-7add27d54959': require('../../assets/silhouettes/6b4546dd-d21b-4631-9352-7add27d54959.png'),
  // 1962–1964 Elva Courier Ford 105E / MGA 1600
  // '5396b91c-5e9e-4a72-9e61-65fb491a1b06': require('../../assets/silhouettes/5396b91c-5e9e-4a72-9e61-65fb491a1b06.png'),
  // 1964–1969 Elva Courier Ford / Triumph
  // '2b8470cb-2ed2-48ec-b589-f19fafca194a': require('../../assets/silhouettes/2b8470cb-2ed2-48ec-b589-f19fafca194a.png'),
  // 1965–1969 Elva Courier BMW 1800 / 2000
  // '879ef09a-1c58-4cda-b341-3a0c1958daad': require('../../assets/silhouettes/879ef09a-1c58-4cda-b341-3a0c1958daad.png'),
  // 1957–1963 Lotus Elite Mk1
  // 'bf16eea6-ff38-466b-85e2-448145e86a16': require('../../assets/silhouettes/bf16eea6-ff38-466b-85e2-448145e86a16.png'),
  // 1962–1980 MG MGB Base
  // '2e163edd-f21d-494b-8a72-8d6a8b27ef82': require('../../assets/silhouettes/2e163edd-f21d-494b-8a72-8d6a8b27ef82.png'),
  // 1968–2004 Morgan Plus 8 Base
  // '0d76fba2-2c33-4310-a857-47d41b1063c8': require('../../assets/silhouettes/0d76fba2-2c33-4310-a857-47d41b1063c8.png'),
  // 1961–1965 Triumph TR4 Base
  // 'a169abda-4fe2-4bdc-b8f0-fddbe838517c': require('../../assets/silhouettes/a169abda-4fe2-4bdc-b8f0-fddbe838517c.png'),
  // 1962–1980 Triumph Spitfire Base
  // '10038fa3-779e-41f8-9ff9-e6634e438340': require('../../assets/silhouettes/10038fa3-779e-41f8-9ff9-e6634e438340.png'),

  // ── vintage_european ──────────────────────────────────────────
  // 1963–1977 Alfa Romeo GTV GTV 2000
  // '5a5fb2e1-392c-4078-982f-2e74b27c8314': require('../../assets/silhouettes/5a5fb2e1-392c-4078-982f-2e74b27c8314.png'),
  // 1966–1969 Alfa Romeo Spider Spider 1750
  // '7c906d45-3eb2-4cfc-b98c-3cac78524d10': require('../../assets/silhouettes/7c906d45-3eb2-4cfc-b98c-3cac78524d10.png'),
  // 1969–1974 Ferrari 246 Dino GT
  // '8bc44276-39b9-4acf-89d3-f1bd8b7dcbcb': require('../../assets/silhouettes/8bc44276-39b9-4acf-89d3-f1bd8b7dcbcb.png'),
  // 1962–1966 Ford Cortina GT Mk1
  // 'c2d38f15-8470-44c5-bf1b-27bcba98f4c9': require('../../assets/silhouettes/c2d38f15-8470-44c5-bf1b-27bcba98f4c9.png'),
  // 1963–1966 Ford Lotus Cortina Mk1
  // 'a2e2b544-2f96-498d-9c76-2cb4d9305668': require('../../assets/silhouettes/a2e2b544-2f96-498d-9c76-2cb4d9305668.png'),
  // 1967–1970 Ford Lotus Cortina Mk2
  // '91aca859-84d0-449e-a774-d69ab113b944': require('../../assets/silhouettes/91aca859-84d0-449e-a774-d69ab113b944.png'),
  // 1961–1975 Jaguar E-Type Series 1 Roadster
  // 'a59df83c-465c-40c4-8356-c065091c2cdf': require('../../assets/silhouettes/a59df83c-465c-40c4-8356-c065091c2cdf.png'),
  // 1965–1976 Lancia Fulvia HF
  // '288d8980-a446-4751-8fe0-8b34fb011448': require('../../assets/silhouettes/288d8980-a446-4751-8fe0-8b34fb011448.png'),
  // 1962–1973 Lotus Elan S4
  // '919f0d28-8bbc-49e7-a95c-1939dedcddd7': require('../../assets/silhouettes/919f0d28-8bbc-49e7-a95c-1939dedcddd7.png'),

  // ── vintage_german_japanese ──────────────────────────────────────────
  // 1970–1973 Datsun 240Z Base
   '759a18d8-9e2f-47db-a57a-16815ec1c843': require('../../assets/silhouettes/datsun-240z.png'),
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  vehicleId?:    string;
  category?:     string;
  height?:       number;  // fallback only — component self-sizes to 2:1 via onLayout
  userImageUri?: string;  // custom user photo — takes priority over all stock images
}

export function VehicleSilhouette({ vehicleId, category, height, userImageUri }: Props) {
  const [bannerWidth, setBannerWidth] = useState(0);
  const source = userImageUri
    ? { uri: userImageUri }
    : (vehicleId && VEHICLE_SILHOUETTES[vehicleId]) ??
      CATEGORY_SILHOUETTES[category ?? 'generic'] ??
      CATEGORY_SILHOUETTES.generic;

  // Enforce 2:1 aspect ratio regardless of source image dimensions.
  // Falls back to explicit height prop or 100px until layout is measured.
  const computedHeight = bannerWidth > 0 ? bannerWidth / 2 : (height ?? 100);

  return (
    <View
      style={[styles.banner, { height: computedHeight }]}
      onLayout={e => setBannerWidth(e.nativeEvent.layout.width)}
    >
      <Image
        source={source}
        style={styles.image}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    backgroundColor: '#0D0D0D',
    borderTopWidth: 0.5,
    borderTopColor: '#2E2E2E',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
});
