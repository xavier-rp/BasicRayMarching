//#version 330 core

// Uniforms
uniform float iTime;
uniform vec2  iResolution;
uniform vec2  iMouse;

const float FOV = 1.0;
const int   MAX_STEPS = 256;
const float MAX_DIST = 500.0;
const float EPSILON = 0.001;

// 2D rotation function
mat2 rot2D(float angle) 
{
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
}

// Rotate around a coordinate axis (i.e. in a plane perpendicular to that axis) by angle <a>.
// Read like this: R(p.xz, a) rotates "x towards z".
// This is fast if <a> is a compile-time constant and slower (but still practical) if not.

float smin( float a, float b, float k )
{
    k *= 6.0;
    float h = max( k-abs(a-b), 0.0 )/k;
    return min(a,b) - h*h*h*k*(1.0/6.0);
}


float opSmoothUnion( float d1, float d2, float k )
{
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}


// function to generate cycling color palettes
// https://iquilezles.org/articles/palettes/
// http://dev.thi.ng/gradients/
vec3 palette(float t)
{
	vec3 a = vec3(0.5, 0.5, 0.5);
	vec3 b = vec3(0.5, 0.5, 0.5); 
	vec3 c = vec3(1.0, 1.0, 1.0);
	vec3 d = vec3(0.263, 0.416, 0.557);
	return a + b*cos( 6.28318*(c*t+d));
}

float sdSphere(vec3 point, float radius)
{
	return length(point) - radius;
}

float fDisplace(vec3 p)
{
	pR(p.yz, sin(2.0 *iTime));
	return (sin(p.x + 4.0*iTime) * sin(p.y + sin(2.0 * iTime)) * sin(p.z + 6.0 * iTime));
}

float sdCube(vec3 point, vec3 sidesHalfLengths)
{
	vec3 q = abs(point) - sidesHalfLengths;
	return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

vec2 fOpUnionID(vec2 res1, vec2 res2)
{
	return res1.x < res2.x ? res1 : res2;
}

vec2 fOpDifferenceID(vec2 res1, vec2 res2)
{
	return (res1.x > -res2.x) ? res1 : vec2(-res2.x, res2.y);
}

vec2 fOpDifferenceColumnsID(vec2 res1, vec2 res2, float r, float n)
{
	float dist = fOpDifferenceColumns(res1.x, res2.x, r, n);
	return (res1.x > - res2.x) ? vec2(dist, res1.y) : vec2(dist, res2.y);
}

vec2 fOpUnionStairsID(vec2 res1, vec2 res2, float r, float n)
{
	float dist = fOpUnionStairs(res1.x, res2.x, r, n);
	return (res1.x < res2.x) ? vec2(dist, res1.y) : vec2(dist, res2.y);
}

vec2 fOpUnionChamferID(vec2 res1, vec2 res2, float r)
{
	float dist = fOpUnionChamfer(res1.x, res2.x, r);
	return (res1.x < res2.x) ? vec2(dist, res1.y) : vec2(dist, res2.y);
}


// Distance to the scene
vec2 map(vec3 p)
{

	float planeDist = fPlane(p, vec3(0.0, 1.0, 0.0), 14.0);
	float planeID = 2.0;
	vec2 plane = vec2(planeDist, planeID);

	float sphereDist = length(p - vec3(0.0, 0.0, 0.0)) - (9.0 + fDisplace(p));
	float sphereID = 1.0;
	vec2 sphere = vec2(sphereDist, sphereID);

	pMirrorOctant(p.xz, vec2(50, 50));
	p.x = -abs(p.x) +20;
	pMod1(p.z, 15);

	//roof
	vec3 pr = p;
	pr.y -= 15.0;
	pR(pr.xy, 0.6);
	pr.x -= 18.0;
	float roofDist = fBox2(pr.xy, vec2(20, 0.3));
	float roofID = 4.0;
	vec2 roof = vec2(roofDist, roofID);

	float cubeDist = sdCube(p, vec3(3.0, 9.0, 4.0));
	float cubeID = 3.0;
	vec2 cube = vec2(cubeDist, cubeID);

	vec3 pc = p;
	pc.y -= 9.0;
	float cylinderDist = fCylinder(pc.yxz, 4, 3);
	float cylinderID = 3.0;
	vec2 cylinder = vec2(cylinderDist, cylinderID);

	// wall
	float wallDist = fBox2(p.xy, vec2(1, 15));
	float wallID = 3.0;
	vec2 wall = vec2(wallDist, wallID);

	vec2 res;
	res = fOpUnionID(cube, cylinder);
	res = fOpDifferenceColumnsID(wall, res, 0.6, 3.0);
	res = fOpUnionChamferID(res, roof, 0.9);
	res = fOpUnionStairsID(res, plane, 4.0, 5.0);
	res = fOpUnionID(res, sphere);
	return res;

}

vec2 rayMarch(vec3 rayOrigin, vec3 rayDirection)
{
	vec3 rayPos;
	vec2 distanceToObject;
	float rayPropagation = 0.0;

	for (int i = 0; i < MAX_STEPS; i++)
	{
		rayPos = rayOrigin + rayPropagation * rayDirection;

		distanceToObject = map(rayPos);
		rayPropagation += distanceToObject[0];

		if (abs(distanceToObject[0]) < EPSILON || (rayPropagation > MAX_DIST))
		{
			break;
		}
	}
	return vec2(rayPropagation, distanceToObject[1]);
}

vec3 getNormal(vec3 p)
{
	// The gradient of a scalar field is always perpendicular to the iso-lines or iso-surfaces 
	// This computes the gradient using central difference. No division by 2h is done, because we normalize the vector
	vec2 h = vec2(EPSILON, 0.0);
	return normalize(vec3(map(p + h.xyy)[0] - map(p - h.xyy)[0], map(p + h.yxy)[0] - map(p-h.yxy)[0], map(p + h.yyx)[0] - map(p - h.yyx)[0]));
}

vec3 getLight(vec3 p, vec3 rayDirection, vec3 color)
{
	vec3 lightPos = vec3(20.0, 48.0, -30.0);
	vec3 directionTowardsLight = normalize(lightPos - p);
	vec3 N = getNormal(p);
	vec3 V = -rayDirection;
	vec3 R = reflect(-directionTowardsLight, N);

	vec3 specColor = vec3(0.5);
	vec3 specular = specColor * pow(clamp(dot(R, V), 0.0, 1.0), 10.0);
	vec3 diffuse = color * clamp(dot(directionTowardsLight, N), 0.0, 1.0);
	vec3 ambient = color * 0.05;
	vec3 fresnel = 0.25 * color * pow(1.0 + dot(rayDirection, N), 3.0);

	//shadows
	float d = rayMarch(p + N * 0.02, directionTowardsLight).x;
	if (d < length(lightPos - p))
	{	
		return ambient; //+ fresnel;//vec3(0.0);
	}
	return diffuse + ambient + specular; //+ fresnel;
}

vec3 getMaterial(vec3 p, float id)
{
	vec3 material;
	switch (int(id)) 
	{
		case 1:
		material = vec3(0.9, 0.0, 0.0); break;
		case 2:
		material = vec3(0.2 + 0.4 * mod(floor(p.x) + floor(p.z), 2.0)); break;
		case 3:
		material = vec3(0.7, 0.8, 0.9); break;
		case 4:
		vec2 i = step(fract(0.5 * p.xz), vec2(1.0 / 10.0)); 
		material = ((1.0 - i.x) * 1.0 - i.y) * vec3(0.37, 0.12, 0.0); break;
	}

	return material;
}

mat3 getCam(vec3 rayOrigin, vec3 lookAt)
{
	vec3 camForward = normalize(vec3(lookAt - rayOrigin));
	vec3 camRight = normalize(cross(vec3(0, 1, 0), camForward));
	vec3 camUp = cross(camForward, camRight);
	return mat3(camRight, camUp, camForward);
}

void mouseControl(inout vec3 rayOrigin)
{
	vec2 m = iMouse / iResolution;
	pR(rayOrigin.yz, m.y * PI * 0.5 - 0.5);
	pR(rayOrigin.xz, m.x * TAU);
}

void render(inout vec3 col, vec2 uv)
{
	vec3 rayOrigin = vec3(0.0, 20.0, -10.0);
	mouseControl(rayOrigin);
	vec3 lookAt = vec3(0.0, 0.0, 0.0);
	vec3 rayDirection = getCam(rayOrigin, lookAt) * normalize(vec3(uv, FOV));

	//vec2 mouseUV = iMouse.xy / iResolution.xy * 2.0 - 1.0;

	// Vertical camera rotation
	//rayOrigin.yz *= rot2D(-mouseUV.y*3.14159);
	//rayDirection.yz *= rot2D(-mouseUV.y*3.14159);

	// Horizontal camera rotation
	//rayDirection.xz *= rot2D(-mouseUV.x*3.14159);
	//rayOrigin.xz *= rot2D(-mouseUV.x*3.14159);

	vec2 object = rayMarch(rayOrigin, rayDirection);

	vec3 background = vec3(0.5, 0.8, 0.9);

	//vec3 col = vec3(0.0, 0.0, 0.0);
	//col = vec3(object[0]/MAX_DIST);
	if (object[0] < MAX_DIST)
	{
		vec3 p = rayOrigin + object[0] * rayDirection;
	
		vec3 material = getMaterial(p, object[1]);
		col += getLight(p, rayDirection, material);

		//fog
		col = mix(col, background, 1.0 - exp(-0.00002 * object[0] * object[0]));
	}
	else
	{
		col += background - max(0.9 * rayDirection.y, 0.0);
	}

}

// Outputs colors in RGBA
out vec4 FragColor;

void main()
{
	// uv coordinates originally go from 0 to 1.
	// with the following operations, we transform the coordinates so they go from -1 to 1
	// and the center of the canvas is now (0, 0).
	vec2 uv = gl_FragCoord.xy / iResolution.xy * 2.0 - 1.0;

	// Scale the u coordinate so that its interval from -1 to 1 spans the same number of pixels as the y coordinate.
	uv.x *= iResolution.x / iResolution.y;

	vec3 col = vec3(0.0, 0.0, 0.0);
	
	render(col, uv);

	//col = vec3(i)/float(80); // Color based on iteration
    //col = vec3(t * 0.07); // Depth-buffer (color based on distance)

	// gamma correction
	col = pow(col, vec3(0.4545));

	FragColor = vec4(col, 1.0);
}