// ../../../carlos Site/netlify/functions/bunny-list.js
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
    const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME || "vz-08277cf8-e40.b-cdn.net";
    if (!BUNNY_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "BUNNY_API_KEY non configur\xE9e"
        })
      };
    }
    const libraryId = event.queryStringParameters?.libraryId || BUNNY_LIBRARY_ID;
    const page = event.queryStringParameters?.page || 1;
    const itemsPerPage = event.queryStringParameters?.itemsPerPage || 100;
    if (!libraryId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "libraryId est requis (query param ou BUNNY_LIBRARY_ID)"
        })
      };
    }
    const listUrl = `https://video.bunnycdn.com/library/${libraryId}/videos?page=${page}&itemsPerPage=${itemsPerPage}`;
    const response = await fetch(listUrl, {
      headers: {
        "AccessKey": BUNNY_API_KEY
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur Bunny.net: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    const videos = data.items || data || [];
    const videosWithUrls = videos.map((video) => ({
      ...video,
      streamingUrl: `https://${BUNNY_CDN_HOSTNAME}/${video.guid || video.id}/play_480p.mp4`,
      thumbnailUrl: video.thumbnailFileName ? `https://${BUNNY_CDN_HOSTNAME}/${video.guid || video.id}/${video.thumbnailFileName}` : null
    }));
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        success: true,
        videos: videosWithUrls,
        total: data.totalItems || videos.length,
        page: parseInt(page),
        itemsPerPage: parseInt(itemsPerPage),
        cdnHostname: BUNNY_CDN_HOSTNAME
      })
    };
  } catch (error) {
    console.error("Erreur liste Bunny.net:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        error: error.message || "Erreur lors de la r\xE9cup\xE9ration des vid\xE9os"
      })
    };
  }
};
//# sourceMappingURL=bunny-list.js.map
