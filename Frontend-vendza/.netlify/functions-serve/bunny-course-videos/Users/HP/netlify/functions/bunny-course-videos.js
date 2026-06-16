// ../../../carlos Site/netlify/functions/bunny-course-videos.js
exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
      },
      body: ""
    };
  }
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }
  try {
    const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
    const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || "549524";
    const BUNNY_WEB_LIBRARY_ID = process.env.BUNNY_WEB_LIBRARY_ID || BUNNY_LIBRARY_ID;
    const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME || "vz-08277cf8-e40.b-cdn.net";
    if (!BUNNY_API_KEY || BUNNY_API_KEY === "your-bunny-api-key-here") {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          error: "BUNNY_API_KEY non configur\xE9e",
          message: "Pour configurer la cl\xE9 API Bunny.net :\n1. Cr\xE9ez un fichier .env \xE0 la racine du projet\n2. Ajoutez : BUNNY_API_KEY=votre-cl\xE9-api\n3. Ou configurez-la dans Netlify : Site settings > Environment variables\n4. Red\xE9marrez netlify dev apr\xE8s modification",
          help: "Voir BUNNY_NETLIFY_SETUP.md pour plus d'informations"
        })
      };
    }
    const courseType = event.queryStringParameters?.courseType || "web";
    const normalizeText = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
    let libraryId = BUNNY_LIBRARY_ID;
    if (courseType === "web" || courseType === "creation-site-web") {
      libraryId = BUNNY_WEB_LIBRARY_ID;
    }
    let courseToCollectionNameMap = {
      "web": "Cr\xE9ation de Site Web",
      "creation-site-web": "Cr\xE9ation de Site Web",
      "leadership": "Leadership Organisationnel",
      "entrepreneuriat": "Entrepreneuriat",
      "communication": "Communication",
      "marketing": "Marketing Digital",
      "dropshipping": "Dropshipping"
    };
    if (process.env.COURSE_COLLECTION_NAME_MAP) {
      try {
        const parsedMap = JSON.parse(process.env.COURSE_COLLECTION_NAME_MAP);
        if (parsedMap && typeof parsedMap === "object" && !Array.isArray(parsedMap)) {
          courseToCollectionNameMap = parsedMap;
        }
      } catch (parseError) {
        console.warn("COURSE_COLLECTION_NAME_MAP invalide (JSON non parsable). Mapping par d\xE9faut utilis\xE9.");
      }
    }
    const expectedCollectionName = courseToCollectionNameMap[courseType] || courseType;
    const normalizedExpectedCollectionName = normalizeText(expectedCollectionName);
    const collectionsUrl = `https://video.bunnycdn.com/library/${libraryId}/collections?page=1&itemsPerPage=100`;
    const collectionsResponse = await fetch(collectionsUrl, {
      headers: {
        "AccessKey": BUNNY_API_KEY
      }
    });
    if (!collectionsResponse.ok) {
      const errorText = await collectionsResponse.text();
      throw new Error(`Erreur Bunny.net collections: ${collectionsResponse.status} - ${errorText}`);
    }
    const collectionsData = await collectionsResponse.json();
    const collections = collectionsData.items || collectionsData || [];
    const matchedCollection = collections.find((collection) => normalizeText(collection?.name) === normalizedExpectedCollectionName) || collections.find((collection) => {
      const currentName = normalizeText(collection?.name);
      return currentName.includes(normalizedExpectedCollectionName) || normalizedExpectedCollectionName.includes(currentName);
    }) || null;
    const collectionId = matchedCollection?.guid || matchedCollection?.id || null;
    if (collectionId) {
      console.log(
        `Collection trouv\xE9e pour ${courseType}: "${matchedCollection.name}" (${collectionId})`
      );
    } else {
      console.warn(
        `Aucune collection trouv\xE9e pour le cours "${courseType}" (nom attendu: "${expectedCollectionName}")`
      );
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          success: true,
          courseType,
          videos: [],
          total: 0,
          libraryId,
          cdnHostname: BUNNY_CDN_HOSTNAME,
          collectionId: null,
          collectionName: expectedCollectionName,
          message: `Aucune collection trouv\xE9e pour "${expectedCollectionName}" dans la library ${libraryId}.`
        })
      };
    }
    const listUrl = `https://video.bunnycdn.com/library/${libraryId}/videos?page=1&itemsPerPage=100`;
    const response = await fetch(listUrl, {
      headers: {
        "AccessKey": BUNNY_API_KEY
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Erreur Bunny.net API: ${response.status}`, errorText);
      if (response.status === 401) {
        throw new Error(`Erreur d'authentification (401): La cl\xE9 API Bunny.net est invalide ou n'a pas les permissions n\xE9cessaires. V\xE9rifiez votre cl\xE9 API dans le fichier .env`);
      }
      throw new Error(`Erreur Bunny.net: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    let videos = data.items || data || [];
    const totalBeforeFilter = videos.length;
    videos = videos.filter((video) => {
      const videoCollectionId = video.collectionId || video.collectionIdList?.[0];
      const videoCollections = video.collections || [];
      if (videoCollectionId === collectionId) {
        return true;
      }
      if (Array.isArray(videoCollections)) {
        return videoCollections.some((col) => {
          const colId = col.id || col.guid || col.collectionId;
          return colId === collectionId;
        });
      }
      return false;
    });
    console.log(`${videos.length} vid\xE9o(s) trouv\xE9e(s) dans la collection "${matchedCollection.name}"`);
    const videosWithUrls = videos.map((video, index) => {
      const videoId = video.guid || video.id;
      return {
        id: videoId,
        guid: video.guid,
        title: video.title || `Vid\xE9o ${index + 1}`,
        description: video.description || "",
        status: video.status,
        duration: video.length || 0,
        views: video.views || 0,
        createdAt: video.dateCreated,
        thumbnailFileName: video.thumbnailFileName,
        // URL du lecteur intégré Bunny.net
        playerUrl: `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`,
        // URL de la playlist HLS
        hlsUrl: `https://${BUNNY_CDN_HOSTNAME}/${videoId}/playlist.m3u8`,
        // URL de streaming directe
        streamingUrl: `https://${BUNNY_CDN_HOSTNAME}/${videoId}/play_480p.mp4`,
        // URL de la miniature
        thumbnailUrl: video.thumbnailFileName ? `https://${BUNNY_CDN_HOSTNAME}/${videoId}/${video.thumbnailFileName}` : `https://${BUNNY_CDN_HOSTNAME}/${videoId}/thumbnail.jpg`,
        // URL de prévisualisation WebP
        previewUrl: `https://${BUNNY_CDN_HOSTNAME}/${videoId}/preview.webp`,
        // URLs pour différentes qualités
        qualities: {
          "480p": `https://${BUNNY_CDN_HOSTNAME}/${videoId}/play_480p.mp4`,
          "720p": `https://${BUNNY_CDN_HOSTNAME}/${videoId}/play_720p.mp4`,
          "1080p": `https://${BUNNY_CDN_HOSTNAME}/${videoId}/play_1080p.mp4`
        }
      };
    });
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        success: true,
        courseType,
        videos: videosWithUrls,
        total: videosWithUrls.length,
        totalBeforeFilter,
        libraryId,
        cdnHostname: BUNNY_CDN_HOSTNAME,
        collectionId: collectionId || null,
        collectionName: matchedCollection?.name || expectedCollectionName
      })
    };
  } catch (error) {
    console.error("Erreur r\xE9cup\xE9ration vid\xE9os cours:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        error: error.message || "Erreur lors de la r\xE9cup\xE9ration des vid\xE9os du cours"
      })
    };
  }
};
//# sourceMappingURL=bunny-course-videos.js.map
