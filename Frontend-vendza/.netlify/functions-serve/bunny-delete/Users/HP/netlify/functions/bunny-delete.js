// ../../../carlos Site/netlify/functions/bunny-delete.js
exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "DELETE, OPTIONS"
      },
      body: ""
    };
  }
  if (event.httpMethod !== "DELETE") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }
  try {
    const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
    const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || "549524";
    if (!BUNNY_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "BUNNY_API_KEY non configur\xE9e"
        })
      };
    }
    const videoId = event.queryStringParameters?.videoId;
    const libraryId = event.queryStringParameters?.libraryId || BUNNY_LIBRARY_ID;
    if (!videoId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "videoId est requis dans les query parameters"
        })
      };
    }
    if (!libraryId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "libraryId est requis (query param ou BUNNY_LIBRARY_ID)"
        })
      };
    }
    const deleteUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`;
    const response = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        "AccessKey": BUNNY_API_KEY
      }
    });
    if (!response.ok) {
      if (response.status === 404) {
        return {
          statusCode: 404,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
          body: JSON.stringify({
            error: "Vid\xE9o non trouv\xE9e"
          })
        };
      }
      const errorText = await response.text();
      throw new Error(`Erreur Bunny.net: ${response.status} - ${errorText}`);
    }
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        success: true,
        message: "Vid\xE9o supprim\xE9e avec succ\xE8s",
        videoId
      })
    };
  } catch (error) {
    console.error("Erreur suppression vid\xE9o Bunny.net:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        error: error.message || "Erreur lors de la suppression de la vid\xE9o"
      })
    };
  }
};
//# sourceMappingURL=bunny-delete.js.map
